const prisma = require("../utils/prisma");
const { createActivity } = require("../utils/activityLogger");

const DEAL_STATUS_MAP = {
  new: 1,
  qualified: 2,
  proposal: 3,
  negotiation: 4,
  won: 5,
  lost: 6,
};

const DEAL_STATUS_LABELS = Object.keys(DEAL_STATUS_MAP);

// Customer status 0 = inactive/blocked
const BLOCKED_CUSTOMER_STATUS = 0;

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
    },
  },
  notes: true,
  tasks: true,
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

    const dealStatusLabel = status ? cleanString(status) : "new";

    if (!DEAL_STATUS_LABELS.includes(dealStatusLabel)) {
      return res.status(400).json({
        message: "Invalid deal status",
        allowed_statuses: DEAL_STATUS_LABELS,
      });
    }

    const dealStatusInt = DEAL_STATUS_MAP[dealStatusLabel];

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
        message: "Cannot create deal for inactive customer",
      });
    }

    const deal = await prisma.deal.create({
      data: {
        customer_id,
        offer: cleanOffer,
        status: dealStatusInt,
        comment: cleanComment,
      },
      include: dealInclude,
    });

    await createActivity({
      entity_type: "deal",
      entity_id: deal.id,
      action: "deal_created",
      description: `Deal created with status ${dealStatusLabel}.`,
      customer_id: deal.customer_id,
      deal_id: deal.id,
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

      if (!DEAL_STATUS_LABELS.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid deal status",
          allowed_statuses: DEAL_STATUS_LABELS,
        });
      }

      where.status = DEAL_STATUS_MAP[cleanStatus];
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
      ];
    }

    const [total, deals] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
        include: dealInclude,
        orderBy: {
          i_id: "desc",
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

    const data = {};

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

      if (!DEAL_STATUS_LABELS.includes(cleanStatus)) {
        return res.status(400).json({
          message: "Invalid deal status",
          allowed_statuses: DEAL_STATUS_LABELS,
        });
      }

      data.status = DEAL_STATUS_MAP[cleanStatus];
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

    const updatedStatusLabel = Object.keys(DEAL_STATUS_MAP).find(
      (k) => DEAL_STATUS_MAP[k] === deal.status
    ) ?? deal.status;

    await createActivity({
      entity_type: "deal",
      entity_id: deal.id,
      action: "deal_updated",
      description: `Deal updated. Current status is ${updatedStatusLabel}.`,
      customer_id: deal.customer_id,
      deal_id: deal.id,
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

    if (!DEAL_STATUS_LABELS.includes(cleanStatus)) {
      return res.status(400).json({
        message: "Invalid deal status",
        allowed_statuses: DEAL_STATUS_LABELS,
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

    const prevStatusLabel =
      Object.keys(DEAL_STATUS_MAP).find(
        (k) => DEAL_STATUS_MAP[k] === existingDeal.status
      ) ?? existingDeal.status;

    const deal = await prisma.deal.update({
      where: {
        id,
      },
      data: {
        status: DEAL_STATUS_MAP[cleanStatus],
        comment: cleanComment ?? existingDeal.comment,
      },
      include: dealInclude,
    });

    await createActivity({
      entity_type: "deal",
      entity_id: deal.id,
      action: "deal_status_updated",
      description: `Deal status changed from ${prevStatusLabel} to ${cleanStatus}.`,
      customer_id: deal.customer_id,
      deal_id: deal.id,
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

    await createActivity({
      entity_type: "deal",
      entity_id: existingDeal.id,
      action: "deal_deleted",
      description: `Deal deleted.`,
      customer_id: existingDeal.customer_id,
      deal_id: existingDeal.id,
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