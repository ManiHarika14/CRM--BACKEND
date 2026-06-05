const prisma = require("../utils/prisma");
const { createActivity } = require("../utils/activityLogger");
const crypto = require("crypto");

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
    req.auth?.user_id ||
    req.auth?.id ||
    null;

  return userId ? String(userId).trim() : null;
};

const noteInclude = {
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
  task: {
    select: {
      id: true,
      customer_id: true,
      deal_id: true,
      title: true,
      status: true,
      priority: true,
      due_date: true,
    },
  },
  note_logs: {
    include: {
      user: {
        select: {
          user_id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      i_id : "asc",
    },
  },
  // removed createdBy/updatedBy includes
};

const createNote = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { customer_id, deal_id, task_id, note } = req.body;

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

    const cleanNote = cleanString(note);

    if (!cleanNote) {
      return res.status(400).json({
        message: "Note is required",
      });
    }

    if (cleanNote.length > 3000) {
      return res.status(400).json({
        message: "Note cannot exceed 3000 characters",
      });
    }

    if (deal_id && !isValidUUID(deal_id)) {
      return res.status(400).json({
        message: "Invalid deal_id",
      });
    }

    if (task_id && !isValidUUID(task_id)) {
      return res.status(400).json({
        message: "Invalid task_id",
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
        message: "Cannot create note for inactive customer",
      });
    }

    if (deal_id) {
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

      if (deal.customer_id !== customer_id) {
        return res.status(400).json({
          message: "Deal does not belong to the selected customer",
        });
      }
    }

    if (task_id) {
      const task = await prisma.task.findUnique({
        where: {
          id: task_id,
        },
      });

      if (!task) {
        return res.status(404).json({
          message: "Task not found",
        });
      }

      if (task.customer_id !== customer_id) {
        return res.status(400).json({
          message: "Task does not belong to the selected customer",
        });
      }

      if (deal_id && task.deal_id && task.deal_id !== deal_id) {
        return res.status(400).json({
          message: "Task does not belong to the selected deal",
        });
      }
    }

    const createdNote = await prisma.note.create({
      data: {
        customer_id,
        deal_id: deal_id || null,
        task_id: task_id || null,
        note: cleanNote,
      },
      include: noteInclude,
    });

    await prisma.notes_Log.create({
      data: {
        id: createdNote.id,
        user_id: req.user.user_id,
        log_type_id: 1,
        date_time: new Date(),
      },
    });

    await createActivity({
      entity_type: "note",
      entity_id: createdNote.id,
      action: "note_created",
      description: "Note created for customer.",
      customer_id: createdNote.customer_id,
      deal_id: createdNote.deal_id,
      task_id: createdNote.task_id,
      note_id: createdNote.id,
    });

    return res.status(201).json({
      message: "Note created successfully",
      note: createdNote,
    });
  } catch (error) {
    console.error("Create note error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getNotes = async (req, res) => {
  try {
    const {
      search,
      customer_id,
      deal_id,
      task_id,
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

    if (task_id) {
      if (!isValidUUID(task_id)) {
        return res.status(400).json({
          message: "Invalid task_id",
        });
      }
      where.task_id = task_id;
    }

    if (search && cleanString(search)) {
      const cleanSearch = cleanString(search);
      where.OR = [
        {
          note: {
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
        {
          deal: {
            offer: {
              contains: cleanSearch,
              mode: "insensitive",
            },
          },
        },
        {
          task: {
            title: {
              contains: cleanSearch,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [total, notes] = await Promise.all([
      prisma.note.count({ where }),
      prisma.note.findMany({
        where,
        include: noteInclude,
        orderBy: {
          i_id: "desc",
        },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);


  const formattedNotes = notes.map((note) => {
  const createdLog = note.note_logs?.[0];

  return {
    ...note,
    createdBy: createdLog?.user?.name || "-",
    createdOn: createdLog?.date_time || null,
  };
});

console.log(JSON.stringify(formattedNotes[0], null, 2));

    return res.status(200).json({
      message: "Notes fetched successfully",
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      notes: formattedNotes,
    });
  } catch (error) {
    console.error("Get notes error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid note id",
      });
    }

    const note = await prisma.note.findUnique({
      where: {
        id,
      },
      include: noteInclude,
    });
    const createdLog = note.note_logs?.[0];
    note.createdBy = createdLog?.user?.name || "-";
note.createdOn = createdLog?.date_time || null;

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    return res.status(200).json({
      message: "Note fetched successfully",
      note,
    });
  } catch (error) {
    console.error("Get note by id error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateNote = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;
    const { customer_id, deal_id, task_id, note } = req.body;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid note id",
      });
    }

    const existingNote = await prisma.note.findUnique({
      where: {
        id,
      },
    });

    if (!existingNote) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    const data = {};

    const finalCustomerId = customer_id || existingNote.customer_id;
    const finalDealId =
      deal_id === undefined
        ? existingNote.deal_id
        : deal_id === null || deal_id === ""
        ? null
        : deal_id;

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
          message: "Cannot assign note to inactive customer",
        });
      }

      data.customer_id = customer_id;
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

    if (task_id !== undefined) {
      if (task_id === null || task_id === "") {
        data.task_id = null;
      } else {
        if (!isValidUUID(task_id)) {
          return res.status(400).json({
            message: "Invalid task_id",
          });
        }

        const task = await prisma.task.findUnique({
          where: {
            id: task_id,
          },
        });

        if (!task) {
          return res.status(404).json({
            message: "Task not found",
          });
        }

        if (task.customer_id !== finalCustomerId) {
          return res.status(400).json({
            message: "Task does not belong to the selected customer",
          });
        }

        if (finalDealId && task.deal_id && task.deal_id !== finalDealId) {
          return res.status(400).json({
            message: "Task does not belong to the selected deal",
          });
        }

        data.task_id = task_id;
      }
    }

    if (note !== undefined) {
      const cleanNote = cleanString(note);

      if (!cleanNote) {
        return res.status(400).json({
          message: "Note cannot be empty",
        });
      }

      if (cleanNote.length > 3000) {
        return res.status(400).json({
          message: "Note cannot exceed 3000 characters",
        });
      }

      data.note = cleanNote;
    }

    const updatedNote = await prisma.note.update({
      where: {
        id,
      },
      data,
      include: noteInclude,
    });
    await prisma.notes_Log.create({
  data: {
    id: updatedNote.id,
    user_id: loggedInUserId,
    log_type_id: 2,
    date_time: new Date(),
  },
});

    await createActivity({
      entity_type: "note",
      entity_id: updatedNote.id,
      action: "note_updated",
      description: "Note updated.",
      customer_id: updatedNote.customer_id,
      deal_id: updatedNote.deal_id,
      task_id: updatedNote.task_id,
      note_id: updatedNote.id,
    });

    return res.status(200).json({
      message: "Note updated successfully",
      note: updatedNote,
    });
  } catch (error) {
    console.error("Update note error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteNote = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid note id",
      });
    }

    const existingNote = await prisma.note.findUnique({
      where: {
        id,
      },
    });

    if (!existingNote) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    await createActivity({
      entity_type: "note",
      entity_id: existingNote.id,
      action: "note_deleted",
      description: "Note deleted.",
      customer_id: existingNote.customer_id,
      deal_id: existingNote.deal_id,
      task_id: existingNote.task_id,
      note_id: existingNote.id,
    });

    await prisma.note.delete({
      where: {
        id,
      },
    });
    await prisma.notesLog.create({
  data: {
    id: existingNote.id,
    user_id: loggedInUserId,
    log_type_id: 2,
    date_time: new Date(),
  },
});

    return res.status(200).json({
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Delete note error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
};