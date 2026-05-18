const prisma = require("../utils/prisma");

const ENTITY_TYPES = ["lead", "customer", "deal", "task", "note"];

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

const activityInclude = {
  lead: {
    select: {
      id: true,
      lead_type: true,
      name: true,
      email: true,
      phone: true,
      company_name: true,
      verification_status: true,
      crm_stage: true,
    },
  },
  customer: {
    select: {
      id: true,
      customer_type: true,
      status: true,
      name: true,
      email: true,
      phone: true,
      company_name: true,
      lead_id: true,
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
  note: {
    select: {
      id: true,
      customer_id: true,
      deal_id: true,
      task_id: true,
      note: true,
    },
  },
  createdBy: {
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

const getActivities = async (req, res) => {
  try {
    const {
      search,
      entity_type,
      entity_id,
      action,
      lead_id,
      customer_id,
      deal_id,
      task_id,
      note_id,
      created_by,
      page = 1,
      limit = 20,
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

    if (entity_type) {
      const cleanEntityType = cleanString(entity_type);

      if (!ENTITY_TYPES.includes(cleanEntityType)) {
        return res.status(400).json({
          message: "Invalid entity_type",
          allowed_entity_types: ENTITY_TYPES,
        });
      }

      where.entity_type = cleanEntityType;
    }

    if (entity_id) {
      if (!isValidUUID(entity_id)) {
        return res.status(400).json({
          message: "Invalid entity_id",
        });
      }

      where.entity_id = String(entity_id).trim();
    }

    if (action && cleanString(action)) {
      where.action = cleanString(action);
    }

    if (lead_id) {
      if (!isValidUUID(lead_id)) {
        return res.status(400).json({
          message: "Invalid lead_id",
        });
      }

      where.lead_id = String(lead_id).trim();
    }

    if (customer_id) {
      if (!isValidUUID(customer_id)) {
        return res.status(400).json({
          message: "Invalid customer_id",
        });
      }

      where.customer_id = String(customer_id).trim();
    }

    if (deal_id) {
      if (!isValidUUID(deal_id)) {
        return res.status(400).json({
          message: "Invalid deal_id",
        });
      }

      where.deal_id = String(deal_id).trim();
    }

    if (task_id) {
      if (!isValidUUID(task_id)) {
        return res.status(400).json({
          message: "Invalid task_id",
        });
      }

      where.task_id = String(task_id).trim();
    }

    if (note_id) {
      if (!isValidUUID(note_id)) {
        return res.status(400).json({
          message: "Invalid note_id",
        });
      }

      where.note_id = String(note_id).trim();
    }

    if (created_by) {
      if (!isValidUUID(created_by)) {
        return res.status(400).json({
          message: "Invalid created_by user id",
        });
      }

      where.created_by = String(created_by).trim();
    }

    if (search && cleanString(search)) {
      const cleanSearch = cleanString(search);

      where.OR = [
        {
          action: {
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
          entity_type: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
      ];
    }

    const [total, activities] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.findMany({
        where,
        include: activityInclude,
        orderBy: {
          created_at: "desc",
        },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);

    return res.status(200).json({
      message: "Activities fetched successfully",
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      activities,
    });
  } catch (error) {
    console.error("Get activities error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid activity id",
      });
    }

    const activity = await prisma.activity.findUnique({
      where: {
        id,
      },
      include: activityInclude,
    });

    if (!activity) {
      return res.status(404).json({
        message: "Activity not found",
      });
    }

    return res.status(200).json({
      message: "Activity fetched successfully",
      activity,
    });
  } catch (error) {
    console.error("Get activity by id error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getActivities,
  getActivityById,
};