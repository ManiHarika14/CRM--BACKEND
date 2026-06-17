const prisma = require("../utils/prisma");
const XLSX = require("xlsx");
const { createActivity } = require("../utils/activityLogger");

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
  user: { select: userSelect },

  customer: {
    include: {
      properties: true,
    },
  },
  comments: {
    orderBy: {
      i_id: "desc",
    },
  },
  lead_logs: {
    include: {
      user: true,
    },
    orderBy: {  
      i_id: "desc",
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

  if (user.status !== 1) {
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

const createLeadComment = async ({
  lead_id,
  comment,
  user_id,
}) => {
 
  console.log("lead_id =", lead_id);
  console.log("comment =", comment);
  console.log("user_id =", user_id);
   

  const createdComment = await prisma.leadComment.create({
    data: {
      lead_id,
      comment: comment.trim(),
    },
  });

  await prisma.lead_Comments_Log.create({
    data: {
      id: createdComment.id,
      user_id: user_id,
      date_time: new Date(),
    },
  });
   console.log("LOG CREATED");

};

const normalizeHeader = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

const cleanImportValue = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned.length ? cleaned : null;
};

const normalizeEmail = (value) => {
  const email = cleanImportValue(value);
  if (!email) return null;
  return email.toLowerCase();
};

const isValidEmail = (value) => {
  if (!value) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(value).trim().toLowerCase());
};

const normalizeLeadType = (value) => {
  const cleaned = cleanImportValue(value);
  if (!cleaned) return "Customer";
  const foundType = allowedLeadTypes.find(
    (type) => type.toLowerCase() === cleaned.toLowerCase()
  );
  return foundType || "Customer";
};

const normalizeVerificationStatus = (value) => {
  const cleaned = cleanImportValue(value);
  if (!cleaned) return "new";
  const normalized = cleaned.toLowerCase().replace(/\s+/g, "_");
  return allowedVerificationStatuses.includes(normalized) ? normalized : "new";
};

const normalizeCrmStage = (value) => {
  const cleaned = cleanImportValue(value);
  if (!cleaned) return "new";
  const normalized = cleaned.toLowerCase().replace(/\s+/g, "_");
  return allowedCrmStages.includes(normalized) ? normalized : "new";
};

const parseImportDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const pickImportValue = (row, possibleHeaders) => {
  for (const header of possibleHeaders) {
    const normalizedHeader = normalizeHeader(header);
    if (row[normalizedHeader] !== undefined && row[normalizedHeader] !== null) {
      return row[normalizedHeader];
    }
  }
  return null;
};

const mapImportRow = (row) => {
  return {
    source: cleanImportValue(
      pickImportValue(row, ["source", "lead source", "lead_source"])
    ),
    source_url: cleanImportValue(
      pickImportValue(row, ["source_url", "source url", "url", "lead_url"])
    ),
    extraction_date: parseImportDate(
      pickImportValue(row, [
        "extraction_date",
        "extraction date",
        "date",
        "created date",
      ])
    ),
    verification_status: normalizeVerificationStatus(
      pickImportValue(row, ["verification_status", "verification status", "status"])
    ),
    confidence: pickImportValue(row, ["confidence", "score"])
      ? Number(pickImportValue(row, ["confidence", "score"]))
      : null,
    crm_stage: normalizeCrmStage(
      pickImportValue(row, ["crm_stage", "crm stage", "stage"])
    ),
  };
};

const getDuplicateKey = (lead) => {
  if (lead.source_url) return `source_url:${lead.source_url}`;
  if (lead.source) return `source:${lead.source}`;
  return null;
};

const chunkArray = (items, size = 1000) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const getRowsFromUploadedFile = (fileBuffer) => {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });
  return rawRows.map((row) => {
    const normalizedRow = {};
    Object.entries(row).forEach(([key, value]) => {
      normalizedRow[normalizeHeader(key)] = value;
    });
    return normalizedRow;
  });
};

const createLead = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body)
    
    const {
      source,
      source_url,
      customer_id,
      extraction_date,
      verification_status,
      confidence,
      crm_stage,
      assigned_to,

      lead_type,
      name,
      email,
      phone,
      address,
      company_name,
      website,
    } = req.body;
    if (!lead_type?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Lead Type is required",
  });
}

if (!name?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Name is required",
  });
}

if (!email?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Email is required",
  });
}

if (!/^\d{10}$/.test(phone)) {
  return res.status(400).json({
    success: false,
    message: "Phone number must contain exactly 10 digits",
  });
}
if (!source) {
  return res.status(400).json({
    success: false,
    message: "Source is required",
  });
}
    
    console.log("customer_id:", customer_id);

    const assignmentError = await validateAssignedUser(assigned_to);

    if (assignmentError) {
      return res.status(400).json({
        success: false,
        message: assignmentError,
      });
    }

    console.log("customer_id:", customer_id);
    console.log(req.body);
    console.log("name:", name);
    console.log("email:", email);
    console.log("lead_type:", lead_type);
    const customer = await prisma.customer.create({
    data: {
    name,
    email,
    customer_type: lead_type,
    status: 1,
  },
});
await prisma.customer_Log.create({
  data: {
    id: customer.id,
    user_id: req.user.user_id, // logged-in user id
    log_type_id: 1,
  },
});

await prisma.customer_Properties.create({
  data: {
    id: customer.id,
    email,
    phone,
    address,
    company_name,
    website,
    contact_info: email,
  },
});

    const lead = await prisma.lead.create({
      data: {
        source,
        source_url,
        customer_id: customer.id,
        extraction_date: extraction_date ? new Date(extraction_date) : null,
        verification_status: verification_status || "new",
        confidence,
        crm_stage: crm_stage || "new",
        user_id: assigned_to,
      },
      include: leadInclude,
    });
    await prisma.leads_Log.create({
  data: {
    id: lead.id,
    user_id: req.user.user_id,
    log_type_id: 1,
    date_time: new Date(),
  },
});

    await createActivity({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead_created",
      description: `Lead created: ${lead.id}`,
      lead_id: lead.id,
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

const importLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Lead import file is required",
      });
    }

    const { assigned_to } = req.body;
    const assignmentError = await validateAssignedUser(assigned_to);

    if (assignmentError) {
      return res.status(400).json({
        success: false,
        message: assignmentError,
      });
    }

    const rows = getRowsFromUploadedFile(req.file.buffer);

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file is empty or has no valid rows",
      });
    }

    if (rows.length > 20000) {
      return res.status(400).json({
        success: false,
        message: "Import limit exceeded. Maximum 20,000 leads are allowed per file.",
        totalRows: rows.length,
      });
    }

    const errors = [];
    const validLeads = [];
    const seenKeys = new Set();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const mappedLead = mapImportRow(row);

      validLeads.push({
        source: mappedLead.source || "import",
        source_url: mappedLead.source_url,
        extraction_date: mappedLead.extraction_date,
        verification_status: mappedLead.verification_status,
        confidence: Number.isFinite(mappedLead.confidence) ? mappedLead.confidence : null,
        crm_stage: mappedLead.crm_stage,
        user_id: assigned_to,
      });
    });

    if (!validLeads.length) {
      return res.status(400).json({
        success: false,
        message: "No valid leads found for import",
        totalRows: rows.length,
        created: 0,
        skipped: rows.length,
        failed: errors.length,
        errors: errors.slice(0, 200),
      });
    }

    const leadsToCreate = validLeads;

    let created = 0;
    const batches = chunkArray(leadsToCreate, 1000);
    for (const batch of batches) {
      const result = await prisma.lead.createMany({
        data: batch,
        skipDuplicates: true,
      });
      created += result.count || 0;
    }

    if (created > 0) {
      try {
        const latestImportedLead = await prisma.lead.findFirst({
          where: {
            source: "import",
          },
          orderBy: {
            i_id: "desc",
          },
          select: {
            id: true,
          },
        });

        if (latestImportedLead?.id) {
          await createActivity({
            entity_type: "lead",
            entity_id: latestImportedLead.id,
            action: "leads_imported",
            description: `Lead import completed. File: ${req.file.originalname}. Created: ${created}. Total rows: ${rows.length}.`,
            lead_id: latestImportedLead.id,
          });
        }
      } catch (activityError) {
        console.error("LEAD IMPORT ACTIVITY LOG ERROR:", activityError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Lead import completed",
      fileName: req.file.originalname,
      totalRows: rows.length,
      created,
      skipped: rows.length - created,
      failed: errors.length,
      errors: errors.slice(0, 200),
      note: errors.length > 200 ? "Only first 200 errors are returned" : undefined,
    });
  } catch (error) {
    console.error("IMPORT LEADS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while importing leads",
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
      include_converted,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (verification_status) where.verification_status = verification_status;
    if (crm_stage) {
      where.crm_stage = crm_stage;
    } else if (include_converted !== "true") {
      where.crm_stage = { not: "converted" };
    }
    if (assigned_to) where.user_id = assigned_to;

    if (search) {
      where.OR = [
        { source: { contains: search, mode: "insensitive" } },
        { source_url: { contains: search, mode: "insensitive" } },
        { verification_status: { contains: search, mode: "insensitive" } },
        { crm_stage: { contains: search, mode: "insensitive" } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { i_id: "desc" },
        include: leadInclude,
      }),
      prisma.lead.count({ where }),
    ]);
    console.log(JSON.stringify(leads, null, 2));

    return res.status(200).json({
      success: true,
      count: leads.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      include_converted: include_converted === "true",
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
      verification_status,
      confidence,
      crm_stage,
      assigned_to,
      comment,
    } = req.body;

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
        verification_status,
        confidence,
        crm_stage,
        user_id: assigned_to,
      },
    });

    await createLeadComment({
      lead_id: id,
      comment,
      user_id: req.user.user_id,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    await createActivity({
      entity_type: "lead",
      entity_id: updatedLead.id,
      action: "lead_updated",
      description: `Lead updated: ${updatedLead.id}`,
      lead_id: updatedLead.id,
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
        user_id: assigned_to,
      },
    });

    await createLeadComment({
      lead_id: id,
      comment,
      user_id: req.user.user_id,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    await createActivity({
      entity_type: "lead",
      entity_id: updatedLead.id,
      action: "lead_assigned",
      description: `Lead assigned from ${lead.user_id || "unassigned"} to ${updatedLead.user_id}.`,
      lead_id: updatedLead.id,
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
      },
    });

    await createLeadComment({
      lead_id: id,
      comment,
      user_id: req.user.user_id,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    await createActivity({
      entity_type: "lead",
      entity_id: updatedLead.id,
      action: "lead_stage_updated",
      description: `Lead stage changed from ${lead.crm_stage} to ${updatedLead.crm_stage}.`,
      lead_id: updatedLead.id,
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
      },
    });

    await createLeadComment({
      lead_id: id,
      comment,
      user_id: req.user.user_id,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    await createActivity({
      entity_type: "lead",
      entity_id: updatedLead.id,
      action: "lead_verification_updated",
      description: `Lead verification changed from ${lead.verification_status} to ${updatedLead.verification_status}.`,
      lead_id: updatedLead.id,
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

    await createActivity({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead_deleted",
      description: `Lead deleted: ${lead.id}`,
      lead_id: lead.id,
    });

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
  importLeads,
  getLeads,
  getLeadById,
  updateLead,
  assignLead,
  updateLeadStage,
  updateVerificationStatus,
  deleteLead,
};