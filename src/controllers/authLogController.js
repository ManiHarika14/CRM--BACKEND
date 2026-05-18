const prisma = require("../utils/prisma");

const AUTH_LOG_ACTIONS = [
  "user_registered",
  "login_success",
  "login_failed",
  "account_inactive_login_attempt",
];

const AUTH_LOG_STATUSES = ["success", "failed", "blocked"];

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

const authLogInclude = {
  user: {
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  },
};

const getAuthLogs = async (req, res) => {
  try {
    const {
      search,
      user_id,
      email,
      action,
      status,
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

    if (user_id) {
      if (!isValidUUID(user_id)) {
        return res.status(400).json({
          message: "Invalid user_id",
        });
      }

      where.user_id = String(user_id).trim();
    }

    if (email && cleanString(email)) {
      where.email = {
        contains: cleanString(email).toLowerCase(),
        mode: "insensitive",
      };
    }

    if (action) {
      const cleanAction = cleanString(action);

      if (!AUTH_LOG_ACTIONS.includes(cleanAction)) {
        return res.status(400).json({
          message: "Invalid auth log action",
          allowed_actions: AUTH_LOG_ACTIONS,
        });
      }

      where.action = cleanAction;
    }

    if (status) {
      const cleanStatus = cleanString(status);

      if (!AUTH_LOG_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid auth log status",
          allowed_statuses: AUTH_LOG_STATUSES,
        });
      }

      where.status = cleanStatus;
    }

    if (search && cleanString(search)) {
      const cleanSearch = cleanString(search);

      where.OR = [
        {
          email: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          action: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          status: {
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
          ip_address: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          user_agent: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          user: {
            name: {
              contains: cleanSearch,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [total, authLogs] = await Promise.all([
      prisma.authLog.count({ where }),
      prisma.authLog.findMany({
        where,
        include: authLogInclude,
        orderBy: {
          created_at: "desc",
        },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);

    return res.status(200).json({
      message: "Auth logs fetched successfully",
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      authLogs,
    });
  } catch (error) {
    console.error("Get auth logs error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getAuthLogById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid auth log id",
      });
    }

    const authLog = await prisma.authLog.findUnique({
      where: {
        id,
      },
      include: authLogInclude,
    });

    if (!authLog) {
      return res.status(404).json({
        message: "Auth log not found",
      });
    }

    return res.status(200).json({
      message: "Auth log fetched successfully",
      authLog,
    });
  } catch (error) {
    console.error("Get auth log by id error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAuthLogs,
  getAuthLogById,
};