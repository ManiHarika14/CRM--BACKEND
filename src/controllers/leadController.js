const prisma = require("../utils/prisma");

const allowedLeadTypes = ["Customer", "Vendor", "AlliedSP", "BConsultant"];

const allowedVerificationStatuses = [
  "new",
  "pending_verification",
  "verified",
  "not_interested",
  "churned",
];

const allowedCrmStages = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "converted",
  "lost",
  "onboarded",
];

const allowedAssignmentRoles = ["admin", "super_admin"];

const userSelect = {
  user_id: true,
  name: true,
  email: true,
  role: true,
};

const leadInclude = {
  assignedUser: { select: userSelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
  comments: {
    orderBy: {
      created_at: "desc",
    },
    include: {
      updatedBy: {
        select: userSelect,
      },
    },
  },
};

const validateAssignedUser = async (assigned_to) => {
  if (!assigned_to) {
    return "assigned_to is required";
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(assigned_to)) {
    return "assigned_to must be a valid user UUID";
  }

  const user = await prisma.user.findUnique({
    where: { user_id: assigned_to },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return "Assigned user not found";
  }

  if (!allowedAssignmentRoles.includes(user.role)) {
    return "Lead can only be assigned to an admin or super_admin user";
  }

  if (user.status !== "active") {
    return "Lead cannot be assigned to an inactive user";
  }

  return null;
};

const validateComment = (comment) => {
  if (!comment || !comment.trim()) {
    return "comment is required";
  }

  return null;
};

const createLeadComment = async ({ lead_id, updated_by, comment }) => {
  await prisma.leadComment.create({
    data: {
      lead_id,
      updated_by,
      comment: comment.trim(),
    },
  });
};

const createLead = async (req, res) => {
  try {
    const {
      source,
      source_url,
      extraction_date,
      lead_type,
      name,
      email,
      phone,
      address,
      company_name,
      website,
      verification_status,
      confidence,
      crm_stage,
      assigned_to,
    } = req.body;

    if (!lead_type) {
      return res.status(400).json({
        success: false,
        message: "lead_type is required",
      });
    }

    if (!allowedLeadTypes.includes(lead_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead_type",
        allowedLeadTypes,
      });
    }

    const assignmentError = await validateAssignedUser(assigned_to);

    if (assignmentError) {
      return res.status(400).json({
        success: false,
        message: assignmentError,
      });
    }

    const lead = await prisma.lead.create({
      data: {
        source,
        source_url,
        extraction_date: extraction_date ? new Date(extraction_date) : null,
        lead_type,
        name,
        email,
        phone,
        address,
        company_name,
        website,
        verification_status: verification_status || "new",
        confidence,
        crm_stage: crm_stage || "new",
        assigned_to,
        created_by: req.user.user_id,
        updated_by: req.user.user_id,
      },
      include: leadInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    console.error("CREATE LEAD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating lead",
    });
  }
};

const getLeads = async (req, res) => {
  try {
    const {
      search,
      lead_type,
      verification_status,
      crm_stage,
      assigned_to,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where = {};

    if (lead_type) where.lead_type = lead_type;
    if (verification_status) where.verification_status = verification_status;
    if (crm_stage) where.crm_stage = crm_stage;
    if (assigned_to) where.assigned_to = assigned_to;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { company_name: { contains: search, mode: "insensitive" } },
        { website: { contains: search, mode: "insensitive" } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: {
          created_at: "desc",
        },
        include: leadInclude,
      }),
      prisma.lead.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      count: leads.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: leads,
    });
  } catch (error) {
    console.error("GET LEADS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching leads",
    });
  }
};

const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("GET LEAD BY ID ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching lead",
    });
  }
};

const updateLead = async (req, res) => {
  try {
    const { id } = req.params;

    const existingLead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const {
      source,
      source_url,
      extraction_date,
      lead_type,
      name,
      email,
      phone,
      address,
      company_name,
      website,
      verification_status,
      confidence,
      crm_stage,
      assigned_to,
      comment,
    } = req.body;

    if (lead_type && !allowedLeadTypes.includes(lead_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead_type",
        allowedLeadTypes,
      });
    }

    if (
      verification_status &&
      !allowedVerificationStatuses.includes(verification_status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification_status",
        allowedVerificationStatuses,
      });
    }

    if (crm_stage && !allowedCrmStages.includes(crm_stage)) {
      return res.status(400).json({
        success: false,
        message: "Invalid crm_stage",
        allowedCrmStages,
      });
    }

    if (assigned_to !== undefined) {
      const assignmentError = await validateAssignedUser(assigned_to);

      if (assignmentError) {
        return res.status(400).json({
          success: false,
          message: assignmentError,
        });
      }
    }

    const commentError = validateComment(comment);

    if (commentError) {
      return res.status(400).json({
        success: false,
        message: commentError,
      });
    }

    await prisma.lead.update({
      where: { id },
      data: {
        source,
        source_url,
        extraction_date: extraction_date ? new Date(extraction_date) : undefined,
        lead_type,
        name,
        email,
        phone,
        address,
        company_name,
        website,
        verification_status,
        confidence,
        crm_stage,
        assigned_to,
        updated_by: req.user.user_id,
      },
    });

    await createLeadComment({
      lead_id: id,
      updated_by: req.user.user_id,
      comment,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("UPDATE LEAD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating lead",
    });
  }
};

const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to, comment } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const assignmentError = await validateAssignedUser(assigned_to);

    if (assignmentError) {
      return res.status(400).json({
        success: false,
        message: assignmentError,
      });
    }

    const commentError = validateComment(comment);

    if (commentError) {
      return res.status(400).json({
        success: false,
        message: commentError,
      });
    }

    await prisma.lead.update({
      where: { id },
      data: {
        assigned_to,
        updated_by: req.user.user_id,
      },
    });

    await createLeadComment({
      lead_id: id,
      updated_by: req.user.user_id,
      comment,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Lead assigned successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("ASSIGN LEAD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while assigning lead",
    });
  }
};

const updateLeadStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { crm_stage, comment } = req.body;

    if (!crm_stage || !allowedCrmStages.includes(crm_stage)) {
      return res.status(400).json({
        success: false,
        message: "Invalid crm_stage",
        allowedCrmStages,
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const commentError = validateComment(comment);

    if (commentError) {
      return res.status(400).json({
        success: false,
        message: commentError,
      });
    }

    await prisma.lead.update({
      where: { id },
      data: {
        crm_stage,
        updated_by: req.user.user_id,
      },
    });

    await createLeadComment({
      lead_id: id,
      updated_by: req.user.user_id,
      comment,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Lead stage updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("UPDATE LEAD STAGE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating lead stage",
    });
  }
};

const updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_status, comment } = req.body;

    if (
      !verification_status ||
      !allowedVerificationStatuses.includes(verification_status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification_status",
        allowedVerificationStatuses,
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const commentError = validateComment(comment);

    if (commentError) {
      return res.status(400).json({
        success: false,
        message: commentError,
      });
    }

    await prisma.lead.update({
      where: { id },
      data: {
        verification_status,
        updated_by: req.user.user_id,
      },
    });

    await createLeadComment({
      lead_id: id,
      updated_by: req.user.user_id,
      comment,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Lead verification status updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("UPDATE VERIFICATION STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating verification status",
    });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await prisma.lead.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("DELETE LEAD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting lead",
    });
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  assignLead,
  updateLeadStage,
  updateVerificationStatus,
  deleteLead,
};