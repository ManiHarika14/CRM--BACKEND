const prisma = require("../utils/prisma");
const { createActivity } = require("../utils/activityLogger");

const TASK_STATUS_MAP = {
  pending: 1,
  in_progress: 2,
  completed: 3,
  cancelled: 4,
};
const TASK_STATUS_LABELS = Object.keys(TASK_STATUS_MAP);

const TASK_PRIORITY_MAP = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};
const TASK_PRIORITY_LABELS = Object.keys(TASK_PRIORITY_MAP);

const BLOCKED_CUSTOMER_STATUS = 0;

const isValidUUID = (value) => {
  if (!value) return false;
  const uuid = String(value).trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const cleanString = (value) => {
  if (typeof value !== "string") return value;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
};

const getLoggedInUserId = (req) => {
  const userId =
    req.user?.user_id ||
    req.user?.id ||
    req.user?.user?.user_id ||
    req.user?.user?.id ||
    req.userId ||
    null;
  return userId ? String(userId).trim() : null;
};

const isValidDate = (value) => {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const taskInclude = {
  customer: {
    select: {
      id: true,
      customer_type: true,
      status: true,
      name: true,
      email: true,
    },
  },
  deal: {
    select: {
      id: true,
      customer_id: true,
      offer: true,
      status: true,
    },
  },
  crm1_users: {
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  },
  crm1_tasks_log: {
    include: {
      crm1_users: {
       select: {
        user_id: true,
        name: true,
        email: true,
      },
    },
  },
  orderBy: {
    date_time: "desc",
  },
}
};

const createTask = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);

    const {
      customer_id,
      deal_id,
      assigned_to,
      title,
      description,
      status,
      priority,
      due_date,
      comment,
    } = req.body;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!customer_id || !isValidUUID(customer_id)) {
      return res.status(400).json({
        message: "Valid customer_id is required",
      });
    }

    if (!assigned_to || !isValidUUID(assigned_to)) {
      return res.status(400).json({
        message: "Valid assigned_to user id is required",
      });
    }

    const cleanTitle = cleanString(title);

    if (!cleanTitle) {
      return res.status(400).json({
        message: "Task title is required",
      });
    }

    if (cleanTitle.length > 255) {
      return res.status(400).json({
        message: "Task title cannot exceed 255 characters",
      });
    }

    const cleanDescription = cleanString(description);

    if (cleanDescription && cleanDescription.length > 2000) {
      return res.status(400).json({
        message: "Description cannot exceed 2000 characters",
      });
    }

    const cleanComment = cleanString(comment);

    if (cleanComment && cleanComment.length > 1000) {
      return res.status(400).json({
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const taskStatusLabel = status ? cleanString(status) : "pending";

    if (!TASK_STATUS_LABELS.includes(taskStatusLabel)) {
      return res.status(400).json({
        message: "Invalid task status",
        allowed_statuses: TASK_STATUS_LABELS,
      });
    }

    const taskPriorityLabel = priority ? cleanString(priority) : "medium";

    if (!TASK_PRIORITY_LABELS.includes(taskPriorityLabel)) {
      return res.status(400).json({
        message: "Invalid task priority",
        allowed_priorities: TASK_PRIORITY_LABELS,
      });
    }

    if (due_date && !isValidDate(due_date)) {
      return res.status(400).json({
        message: "Invalid due_date",
      });
    }

    if (deal_id && !isValidUUID(deal_id)) {
      return res.status(400).json({
        message: "Invalid deal_id",
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customer_id },
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    if (customer.status === BLOCKED_CUSTOMER_STATUS) {
      return res.status(400).json({
        message: "Cannot create task for inactive customer",
      });
    }

    const assignedUser = await prisma.user.findUnique({
      where: { user_id: assigned_to },
    });

    if (!assignedUser) {
      return res.status(404).json({
        message: "Assigned user not found",
      });
    }

    if (assignedUser.status !== 1) {
      return res.status(400).json({
        message: "Assigned user must be active",
      });
    }

    if (deal_id) {
      const deal = await prisma.deal.findUnique({
        where: { id: deal_id },
      });

      if (!deal) {
        return res.status(404).json({
          message: "Deal not found",
        });
      }

      if (deal.customer_id !== customer_id) {
        return res.status(400).json({
          message: "Deal does not belong to the selected customer",
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        customer_id,
        deal_id: deal_id || null,
        assigner_to: assigned_to,
        title: cleanTitle,
        description: cleanDescription,
        status: TASK_STATUS_MAP[taskStatusLabel],
        priority: TASK_PRIORITY_MAP[taskPriorityLabel],
        due_date: due_date ? new Date(due_date) : null,
        comment: cleanComment,
      },
      include: taskInclude,
    });

  await prisma.tasks_Log.create({
  data: {
    id: task.id,
    user_id: req.user.user_id,
    log_type_id: 1,
    date_time: new Date(),
  },
});

    await createActivity({
      entity_type: "task",
      entity_id: task.id,
      action: "task_created",
      description: `Task created: ${task.title}`,
      customer_id: task.customer_id,
      deal_id: task.deal_id,
      task_id: task.id,
    });

    return res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const {
      search,
      status,
      priority,
      customer_id,
      deal_id,
      assigned_to,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return res.status(400).json({
        message: "Page must be a positive integer",
      });
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        message: "Limit must be between 1 and 100",
      });
    }

    const where = {};

    if (status) {
      const cleanStatus = cleanString(status);

      if (!TASK_STATUS_LABELS.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid task status",
          allowed_statuses: TASK_STATUS_LABELS,
        });
      }

      where.status = TASK_STATUS_MAP[cleanStatus];
    }

    if (priority) {
      const cleanPriority = cleanString(priority);

      if (!TASK_PRIORITY_LABELS.includes(cleanPriority)) {
        return res.status(400).json({
          message: "Invalid task priority",
          allowed_priorities: TASK_PRIORITY_LABELS,
        });
      }

      where.priority = TASK_PRIORITY_MAP[cleanPriority];
    }

    if (customer_id) {
      if (!isValidUUID(customer_id)) {
        return res.status(400).json({
          message: "Invalid customer_id",
        });
      }

      where.customer_id = customer_id;
    }

    if (deal_id) {
      if (!isValidUUID(deal_id)) {
        return res.status(400).json({
          message: "Invalid deal_id",
        });
      }

      where.deal_id = deal_id;
    }

    if (assigned_to) {
      if (!isValidUUID(assigned_to)) {
        return res.status(400).json({
          message: "Invalid assigned_to user id",
        });
      }

      where.assigner_to = assigned_to;
    }

    if (search && cleanString(search)) {
      const cleanSearch = cleanString(search);
      where.OR = [
        {
          title: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          comment: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          customer: {
            name: {
              contains: cleanSearch,
              mode: "insensitive",
            },
          },
        },
        {
          customer: {
            email: {
              contains: cleanSearch,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: {
          i_id: "desc",
        },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);
    console.log(JSON.stringify(tasks[0], null, 2));

    return res.status(200).json({
      message: "Tasks fetched successfully",
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      tasks,
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid task id",
      });
    }

    const task = await prisma.task.findUnique({
      where: {
        id,
      },
      include: taskInclude,
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    return res.status(200).json({
      message: "Task fetched successfully",
      task,
    });
  } catch (error) {
    console.error("Get task by id error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;

    const {
      customer_id,
      deal_id,
      assigned_to,
      title,
      description,
      status,
      priority,
      due_date,
      comment,
    } = req.body;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid task id",
      });
    }

    const existingTask = await prisma.task.findUnique({
      where: {
        id,
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const data = {};

    const finalCustomerId = customer_id || existingTask.customer_id;

    if (customer_id !== undefined) {
      if (!isValidUUID(customer_id)) {
        return res.status(400).json({
          message: "Invalid customer_id",
        });
      }

      const customer = await prisma.customer.findUnique({
        where: {
          id: customer_id,
        },
      });

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }

      if (customer.status === BLOCKED_CUSTOMER_STATUS) {
        return res.status(400).json({
          message: "Cannot assign task to inactive customer",
        });
      }

      data.customer_id = customer_id;
    }

    if (assigned_to !== undefined) {
      if (!isValidUUID(assigned_to)) {
        return res.status(400).json({
          message: "Invalid assigned_to user id",
        });
      }

      const assignedUser = await prisma.user.findUnique({
        where: {
          user_id: assigned_to,
        },
      });

      if (!assignedUser) {
        return res.status(404).json({
          message: "Assigned user not found",
        });
      }

      if (assignedUser.status !== 1) {
        return res.status(400).json({
          message: "Assigned user must be active",
        });
      }

      data.assigner_to = assigned_to;
    }

    if (deal_id !== undefined) {
      if (deal_id === null || deal_id === "") {
        data.deal_id = null;
      } else {
        if (!isValidUUID(deal_id)) {
          return res.status(400).json({
            message: "Invalid deal_id",
          });
        }

        const deal = await prisma.deal.findUnique({
          where: {
            id: deal_id,
          },
        });

        if (!deal) {
          return res.status(404).json({
            message: "Deal not found",
          });
        }

        if (deal.customer_id !== finalCustomerId) {
          return res.status(400).json({
            message: "Deal does not belong to the selected customer",
          });
        }

        data.deal_id = deal_id;
      }
    }

    if (title !== undefined) {
      const cleanTitle = cleanString(title);

      if (!cleanTitle) {
        return res.status(400).json({
          message: "Task title cannot be empty",
        });
      }

      if (cleanTitle.length > 255) {
        return res.status(400).json({
          message: "Task title cannot exceed 255 characters",
        });
      }

      data.title = cleanTitle;
    }

    if (description !== undefined) {
      const cleanDescription = cleanString(description);

      if (cleanDescription && cleanDescription.length > 2000) {
        return res.status(400).json({
          message: "Description cannot exceed 2000 characters",
        });
      }

      data.description = cleanDescription;
    }

    if (status !== undefined) {
      const cleanStatus = cleanString(status);

      if (!TASK_STATUS_LABELS.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid task status",
          allowed_statuses: TASK_STATUS_LABELS,
        });
      }

      data.status = TASK_STATUS_MAP[cleanStatus];
    }

    if (priority !== undefined) {
      const cleanPriority = cleanString(priority);

      if (!TASK_PRIORITY_LABELS.includes(cleanPriority)) {
        return res.status(400).json({
          message: "Invalid task priority",
          allowed_priorities: TASK_PRIORITY_LABELS,
        });
      }

      data.priority = TASK_PRIORITY_MAP[cleanPriority];
    }

    if (due_date !== undefined) {
      if (due_date === null || due_date === "") {
        data.due_date = null;
      } else {
        if (!isValidDate(due_date)) {
          return res.status(400).json({
            message: "Invalid due_date",
          });
        }

        data.due_date = new Date(due_date);
      }
    }

    if (comment !== undefined) {
      const cleanComment = cleanString(comment);

      if (cleanComment && cleanComment.length > 1000) {
        return res.status(400).json({
          message: "Comment cannot exceed 1000 characters",
        });
      }

      data.comment = cleanComment;
    }

    const task = await prisma.task.update({
      where: {
        id,
      },
      data,
      include: taskInclude,
    });

    await prisma.tasks_Log.create({
  data: {
    id: updatedTask.id,
    user_id: req.user.user_id,
    log_type_id: 2,
    date_time: new Date(),
  },
});

    await createActivity({
      entity_type: "task",
      entity_id: task.id,
      action: "task_updated",
      description: `Task updated: ${task.title}`,
      customer_id: task.customer_id,
      deal_id: task.deal_id,
      task_id: task.id,
    });

    return res.status(200).json({
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;
    const { status, comment } = req.body;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid task id",
      });
    }

    const cleanStatus = cleanString(status);

    if (!cleanStatus) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    if (!TASK_STATUS_LABELS.includes(cleanStatus)) {
      return res.status(400).json({
        message: "Invalid task status",
        allowed_statuses: TASK_STATUS_LABELS,
      });
    }

    const cleanComment = cleanString(comment);

    if (cleanComment && cleanComment.length > 1000) {
      return res.status(400).json({
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const prevStatusLabel =
      Object.keys(TASK_STATUS_MAP).find(
        (k) => TASK_STATUS_MAP[k] === existingTask.status
      ) ?? existingTask.status;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: TASK_STATUS_MAP[cleanStatus],
        comment: cleanComment ?? existingTask.comment,
      },
      include: taskInclude,
    });

    await createActivity({
      entity_type: "task",
      entity_id: task.id,
      action: "task_status_updated",
      description: `Task status changed from ${prevStatusLabel} to ${cleanStatus}.`,
      customer_id: task.customer_id,
      deal_id: task.deal_id,
      task_id: task.id,
    });

    return res.status(200).json({
      message: "Task status updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task status error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid task id",
      });
    }

    const existingTask = await prisma.task.findUnique({
      where: {
        id,
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    await createActivity({
      entity_type: "task",
      entity_id: existingTask.id,
      action: "task_deleted",
      description: `Task deleted: ${existingTask.title}`,
      customer_id: existingTask.customer_id,
      deal_id: existingTask.deal_id,
      task_id: existingTask.id,
    });

    await prisma.task.delete({
      where: {
        id,
      },
    });
    await prisma.tasks_Log.create({
  data: {
    id: existingTask.id,
    user_id: req.user.user_id,
    log_type_id: 3,
    date_time: new Date(),
  },
});

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
};