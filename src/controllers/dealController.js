const prisma = require("../utils/prisma");

const DEAL_STATUSES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

const BLOCKED_CUSTOMER_STATUSES = ["archived", "blacklisted"];

const isValidUUID = (value) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return typeof value === "string" && uuidRegex.test(value);
};

const cleanString = (value) => {
  if (typeof value !== "string") return value;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
};

const getLoggedInUserId = (req) => {
  return req.user?.user_id || req.user?.id || req.userId || null;
};

const dealInclude = {
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
  createdBy: {
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  updatedBy: {
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

const createDeal = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);

    const { customer_id, offer, status, comment } = req.body;

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

    const cleanOffer = cleanString(offer);

    if (!cleanOffer) {
      return res.status(400).json({
        message: "Offer is required",
      });
    }

    if (cleanOffer.length > 2000) {
      return res.status(400).json({
        message: "Offer cannot exceed 2000 characters",
      });
    }

    const cleanComment = cleanString(comment);

    if (cleanComment && cleanComment.length > 1000) {
      return res.status(400).json({
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const dealStatus = status ? cleanString(status) : "new";

    if (!DEAL_STATUSES.includes(dealStatus)) {
      return res.status(400).json({
        message: "Invalid deal status",
        allowed_statuses: DEAL_STATUSES,
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

    if (BLOCKED_CUSTOMER_STATUSES.includes(customer.status)) {
      return res.status(400).json({
        message: `Cannot create deal for ${customer.status} customer`,
      });
    }

    const deal = await prisma.deal.create({
      data: {
        customer_id,
        offer: cleanOffer,
        status: dealStatus,
        comment: cleanComment,
        created_by: loggedInUserId,
        updated_by: loggedInUserId,
      },
      include: dealInclude,
    });

    return res.status(201).json({
      message: "Deal created successfully",
      deal,
    });
  } catch (error) {
    console.error("Create deal error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getDeals = async (req, res) => {
  try {
    const { search, status, customer_id, page = 1, limit = 10 } = req.query;

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

      if (!DEAL_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid deal status",
          allowed_statuses: DEAL_STATUSES,
        });
      }

      where.status = cleanStatus;
    }

    if (customer_id) {
      if (!isValidUUID(customer_id)) {
        return res.status(400).json({
          message: "Invalid customer_id",
        });
      }

      where.customer_id = customer_id;
    }

    if (search && cleanString(search)) {
      const cleanSearch = cleanString(search);

      where.OR = [
        {
          offer: {
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
        {
          customer: {
            company_name: {
              contains: cleanSearch,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [total, deals] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
        include: dealInclude,
        orderBy: {
          created_at: "desc",
        },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
    ]);

    return res.status(200).json({
      message: "Deals fetched successfully",
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      deals,
    });
  } catch (error) {
    console.error("Get deals error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getDealById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid deal id",
      });
    }

    const deal = await prisma.deal.findUnique({
      where: {
        id,
      },
      include: dealInclude,
    });

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    return res.status(200).json({
      message: "Deal fetched successfully",
      deal,
    });
  } catch (error) {
    console.error("Get deal by id error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateDeal = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;
    const { offer, status, comment } = req.body;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid deal id",
      });
    }

    const existingDeal = await prisma.deal.findUnique({
      where: {
        id,
      },
    });

    if (!existingDeal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    const data = {
      updated_by: loggedInUserId,
    };

    if (offer !== undefined) {
      const cleanOffer = cleanString(offer);

      if (!cleanOffer) {
        return res.status(400).json({
          message: "Offer cannot be empty",
        });
      }

      if (cleanOffer.length > 2000) {
        return res.status(400).json({
          message: "Offer cannot exceed 2000 characters",
        });
      }

      data.offer = cleanOffer;
    }

    if (status !== undefined) {
      const cleanStatus = cleanString(status);

      if (!DEAL_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid deal status",
          allowed_statuses: DEAL_STATUSES,
        });
      }

      data.status = cleanStatus;
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

    const deal = await prisma.deal.update({
      where: {
        id,
      },
      data,
      include: dealInclude,
    });

    return res.status(200).json({
      message: "Deal updated successfully",
      deal,
    });
  } catch (error) {
    console.error("Update deal error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateDealStatus = async (req, res) => {
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
        message: "Invalid deal id",
      });
    }

    const cleanStatus = cleanString(status);

    if (!cleanStatus) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    if (!DEAL_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        message: "Invalid deal status",
        allowed_statuses: DEAL_STATUSES,
      });
    }

    const cleanComment = cleanString(comment);

    if (cleanComment && cleanComment.length > 1000) {
      return res.status(400).json({
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const existingDeal = await prisma.deal.findUnique({
      where: {
        id,
      },
    });

    if (!existingDeal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    const deal = await prisma.deal.update({
      where: {
        id,
      },
      data: {
        status: cleanStatus,
        comment: cleanComment ?? existingDeal.comment,
        updated_by: loggedInUserId,
      },
      include: dealInclude,
    });

    return res.status(200).json({
      message: "Deal status updated successfully",
      deal,
    });
  } catch (error) {
    console.error("Update deal status error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid deal id",
      });
    }

    const existingDeal = await prisma.deal.findUnique({
      where: {
        id,
      },
    });

    if (!existingDeal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    await prisma.deal.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "Deal deleted successfully",
    });
  } catch (error) {
    console.error("Delete deal error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  updateDealStatus,
  deleteDeal,
};