const prisma = require("../utils/prisma");

const CUSTOMER_TYPES = ["Customer", "Vendor", "BConsultant", "AlliedSP"];

const CUSTOMER_STATUSES = ["active", "inactive", "blacklisted", "archived"];

const LEAD_ALLOWED_VERIFICATION_STATUS = "verified";

const BLOCKED_LEAD_STATUSES = ["not_interested", "churned"];

const BLOCKED_LEAD_STAGES = ["lost"];

const isValidUUID = (value) => {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

const isValidEmail = (email) => {
  if (!email) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidWebsite = (website) => {
  if (!website) return true;

  try {
    new URL(website);
    return true;
  } catch {
    return false;
  }
};

const isValidPhone = (phone) => {
  if (!phone) return true;

  return /^[0-9+\-\s()]{6,25}$/.test(phone);
};

const cleanString = (value) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

const getLoggedInUserId = (req) => {
  return req.user?.user_id || req.user?.id || null;
};

const customerInclude = {
  lead: true,
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

const validateCustomerPayload = (body, mode = "create") => {
  const errors = [];

  const {
    customer_type,
    status,
    name,
    email,
    phone,
    address,
    company_name,
    website,
    contact_info,
    comments,
  } = body;

  if (mode === "create") {
    if (!customer_type) {
      errors.push("customer_type is required");
    }

    const hasBasicIdentity =
      cleanString(name) ||
      cleanString(email) ||
      cleanString(phone) ||
      cleanString(company_name);

    if (!hasBasicIdentity) {
      errors.push(
        "At least one of name, email, phone, or company_name is required"
      );
    }
  }

  if (customer_type && !CUSTOMER_TYPES.includes(customer_type)) {
    errors.push(
      `Invalid customer_type. Allowed values: ${CUSTOMER_TYPES.join(", ")}`
    );
  }

  if (status && !CUSTOMER_STATUSES.includes(status)) {
    errors.push(
      `Invalid status. Allowed values: ${CUSTOMER_STATUSES.join(", ")}`
    );
  }

  if (!isValidEmail(email)) {
    errors.push("Invalid email format");
  }

  if (!isValidPhone(phone)) {
    errors.push("Invalid phone format");
  }

  if (!isValidWebsite(website)) {
    errors.push("Invalid website URL. Example: https://example.com");
  }

  if (name && name.length > 150) {
    errors.push("Name cannot exceed 150 characters");
  }

  if (email && email.length > 150) {
    errors.push("Email cannot exceed 150 characters");
  }

  if (phone && phone.length > 25) {
    errors.push("Phone cannot exceed 25 characters");
  }

  if (company_name && company_name.length > 200) {
    errors.push("Company name cannot exceed 200 characters");
  }

  if (website && website.length > 250) {
    errors.push("Website cannot exceed 250 characters");
  }

  if (address && address.length > 500) {
    errors.push("Address cannot exceed 500 characters");
  }

  if (contact_info && contact_info.length > 1000) {
    errors.push("Contact info cannot exceed 1000 characters");
  }

  if (comments && comments.length > 1000) {
    errors.push("Comments cannot exceed 1000 characters");
  }

  return errors;
};

const buildCustomerData = (body, loggedInUserId, isCreate = false) => {
  const data = {
    customer_type: cleanString(body.customer_type),
    status: cleanString(body.status)|| undefined,
    name: cleanString(body.name),
    email: body.email ? cleanString(body.email).toLowerCase() : null,
    phone: cleanString(body.phone),
    address: cleanString(body.address),
    company_name: cleanString(body.company_name),
    website: cleanString(body.website),
    contact_info: cleanString(body.contact_info),
    comments: cleanString(body.comments),
    updated_by: loggedInUserId,
  };

  if (isCreate) {
    data.created_by = loggedInUserId;
  }

  return data;
};

// CREATE CUSTOMER MANUALLY
const createCustomer = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    const validationErrors = validateCustomerPayload(req.body, "create");

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const { email, phone, company_name } = req.body;

    const duplicateConditions = [];

    if (email) {
      duplicateConditions.push({
        email: cleanString(email).toLowerCase(),
      });
    }

    if (phone) {
      duplicateConditions.push({
        phone: cleanString(phone),
      });
    }

    if (company_name) {
      duplicateConditions.push({
        company_name: cleanString(company_name),
      });
    }

    if (duplicateConditions.length > 0) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: duplicateConditions,
        },
      });

      if (existingCustomer) {
        return res.status(409).json({
          message:
            "Possible duplicate customer found using email, phone, or company name",
          existing_customer_id: existingCustomer.id,
        });
      }
    }

    const customer = await prisma.customer.create({
      data: buildCustomerData(req.body, loggedInUserId, true),
      include: customerInclude,
    });

    return res.status(201).json({
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Create customer error:", error);

    return res.status(500).json({
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

// GET ALL CUSTOMERS
const getCustomers = async (req, res) => {
  try {
    const { search, customer_type, status, page = 1, limit = 10 } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return res.status(400).json({
        message: "Page must be a positive number",
      });
    }

    if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      return res.status(400).json({
        message: "Limit must be between 1 and 100",
      });
    }

    if (customer_type && !CUSTOMER_TYPES.includes(customer_type)) {
      return res.status(400).json({
        message: "Invalid customer_type",
        allowed_types: CUSTOMER_TYPES,
      });
    }

    if (status && !CUSTOMER_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid status",
          allowed_statuses: CUSTOMER_STATUSES,
        });
      }

    const skip = (pageNumber - 1) * limitNumber;

    const where = {};

    if (customer_type) {
      where.customer_type = customer_type;
    }

    if (status) {
        where.status = status;
      } else {
        where.status = {
          not: "archived",
        };
      }

    if (search && search.trim()) {
      const cleanSearch = search.trim();

      where.OR = [
        { name: { contains: cleanSearch, mode: "insensitive" } },
        { email: { contains: cleanSearch, mode: "insensitive" } },
        { phone: { contains: cleanSearch, mode: "insensitive" } },
        { company_name: { contains: cleanSearch, mode: "insensitive" } },
        { contact_info: { contains: cleanSearch, mode: "insensitive" } },
        { comments: { contains: cleanSearch, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: customerInclude,
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limitNumber,
      }),
      prisma.customer.count({ where }),
    ]);

    return res.status(200).json({
      message: "Customers fetched successfully",
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// GET CUSTOMER BY ID
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: "Invalid customer id",
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: customerInclude,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      message: "Customer fetched successfully",
      customer,
    });
  } catch (error) {
    console.error("Get customer by id error:", error);

    return res.status(500).json({
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// UPDATE CUSTOMER
const updateCustomer = async (req, res) => {
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
        message: "Invalid customer id",
      });
    }

    const validationErrors = validateCustomerPayload(req.body, "update");

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const { email, phone, company_name } = req.body;

    const duplicateConditions = [];

    if (email) {
      duplicateConditions.push({
        email: cleanString(email).toLowerCase(),
      });
    }

    if (phone) {
      duplicateConditions.push({
        phone: cleanString(phone),
      });
    }

    if (company_name) {
      duplicateConditions.push({
        company_name: cleanString(company_name),
      });
    }

    if (duplicateConditions.length > 0) {
      const duplicateCustomer = await prisma.customer.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: duplicateConditions,
        },
      });

      if (duplicateCustomer) {
        return res.status(409).json({
          message:
            "Another customer already exists with the same email, phone, or company name",
          existing_customer_id: duplicateCustomer.id,
        });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: buildCustomerData(req.body, loggedInUserId, false),
      include: customerInclude,
    });

    return res.status(200).json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("Update customer error:", error);

    return res.status(500).json({
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

// CONVERT LEAD TO CUSTOMER
const convertLeadToCustomer = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { leadId } = req.params;
    const { comments } = req.body;
    
    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(leadId)) {
      return res.status(400).json({
        message: "Invalid lead id",
      });
    }

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        message: "Comment is required to convert lead to customer",
      });
    }

    if (comments.length > 1000) {
      return res.status(400).json({
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        customer: true,
        assignedUser: true,
      },
    });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    if (lead.customer) {
      return res.status(400).json({
        message: "This lead is already converted to customer",
        customer_id: lead.customer.id,
      });
    }

    if (!CUSTOMER_TYPES.includes(lead.lead_type)) {
      return res.status(400).json({
        message: "Lead type cannot be converted to customer",
        current_lead_type: lead.lead_type,
        allowed_types: CUSTOMER_TYPES,
      });
    }

    if (BLOCKED_LEAD_STATUSES.includes(lead.verification_status)) {
      return res.status(400).json({
        message: "This lead cannot be converted because it is not interested or churned",
        current_verification_status: lead.verification_status,
      });
    }

    if (lead.verification_status !== LEAD_ALLOWED_VERIFICATION_STATUS) {
      return res.status(400).json({
        message: "Only verified leads can be converted to customer",
        current_verification_status: lead.verification_status,
      });
    }

    if (BLOCKED_LEAD_STAGES.includes(lead.crm_stage)) {
      return res.status(400).json({
        message: "Lost leads cannot be converted to customer",
        current_crm_stage: lead.crm_stage,
      });
    }

    const hasBasicCustomerData =
      lead.name || lead.email || lead.phone || lead.company_name;

    if (!hasBasicCustomerData) {
      return res.status(400).json({
        message:
          "Lead cannot be converted because it has no name, email, phone, or company name",
      });
    }

    if (!isValidEmail(lead.email)) {
      return res.status(400).json({
        message: "Lead email is invalid. Fix lead email before conversion.",
      });
    }

    if (!isValidPhone(lead.phone)) {
      return res.status(400).json({
        message: "Lead phone is invalid. Fix lead phone before conversion.",
      });
    }

    if (!isValidWebsite(lead.website)) {
      return res.status(400).json({
        message: "Lead website is invalid. Fix lead website before conversion.",
      });
    }

    const duplicateConditions = [];

    if (lead.email) {
      duplicateConditions.push({
        email: lead.email.toLowerCase(),
      });
    }

    if (lead.phone) {
      duplicateConditions.push({
        phone: lead.phone,
      });
    }

    if (lead.company_name) {
      duplicateConditions.push({
        company_name: lead.company_name,
      });
    }

    if (duplicateConditions.length > 0) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: duplicateConditions,
        },
      });

      if (existingCustomer) {
        return res.status(409).json({
          message:
            "Possible duplicate customer already exists using lead email, phone, or company name",
          existing_customer_id: existingCustomer.id,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          lead_id: lead.id,
          customer_type: lead.lead_type,
          status: "active",
          name: cleanString(lead.name),
          email: lead.email ? cleanString(lead.email).toLowerCase() : null,
          phone: cleanString(lead.phone),
          address: cleanString(lead.address),
          company_name: cleanString(lead.company_name),
          website: cleanString(lead.website),
          contact_info: null,
          comments: cleanString(comments),
          created_by: loggedInUserId,
          updated_by: loggedInUserId,
        },
        include: customerInclude,
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          crm_stage: "converted",
          updated_by: loggedInUserId,
        },
      });

      const leadComment = await tx.leadComment.create({
        data: {
          lead_id: lead.id,
          updated_by: loggedInUserId,
          comment: cleanString(comments),
        },
      });

      return {
        customer,
        updatedLead,
        leadComment,
      };
    });

    return res.status(201).json({
      message: "Lead converted to customer successfully",
      customer: result.customer,
      lead: result.updatedLead,
      leadComment: result.leadComment,
    });
  } catch (error) {
    console.error("Convert lead to customer error:", error);

    return res.status(500).json({
      message: "Failed to convert lead to customer",
      error: error.message,
    });
  }
};

// UPDATE CUSTOMER STATUS
const updateCustomerStatus = async (req, res) => {
    try {
      const loggedInUserId = getLoggedInUserId(req);
      const { id } = req.params;
      const { status, comments } = req.body;
  
      if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
        return res.status(401).json({
          message: "Unauthorized. Valid logged-in user is required.",
        });
      }
  
      if (!isValidUUID(id)) {
        return res.status(400).json({
          message: "Invalid customer id",
        });
      }
  
      if (!status || !CUSTOMER_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid status",
          allowed_statuses: CUSTOMER_STATUSES,
        });
      }
  
      if (comments && comments.length > 1000) {
        return res.status(400).json({
          message: "Comments cannot exceed 1000 characters",
        });
      }
  
      const existingCustomer = await prisma.customer.findUnique({
        where: { id },
      });
  
      if (!existingCustomer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }
  
      const customer = await prisma.customer.update({
        where: { id },
        data: {
          status,
          comments: cleanString(comments) || existingCustomer.comments,
          updated_by: loggedInUserId,
        },
        include: customerInclude,
      });
  
      return res.status(200).json({
        message: "Customer status updated successfully",
        customer,
      });
    } catch (error) {
      console.error("Update customer status error:", error);
  
      return res.status(500).json({
        message: "Failed to update customer status",
        error: error.message,
      });
    }
  };
  
  // ARCHIVE CUSTOMER INSTEAD OF HARD DELETE
  const archiveCustomer = async (req, res) => {
    try {
      const loggedInUserId = getLoggedInUserId(req);
      const { id } = req.params;
      const { comments } = req.body;
  
      if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
        return res.status(401).json({
          message: "Unauthorized. Valid logged-in user is required.",
        });
      }
  
      if (!isValidUUID(id)) {
        return res.status(400).json({
          message: "Invalid customer id",
        });
      }
  
      if (comments && comments.length > 1000) {
        return res.status(400).json({
          message: "Comments cannot exceed 1000 characters",
        });
      }
  
      const existingCustomer = await prisma.customer.findUnique({
        where: { id },
      });
  
      if (!existingCustomer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }
  
      if (existingCustomer.status === "archived") {
        return res.status(400).json({
          message: "Customer is already archived",
        });
      }
  
      const customer = await prisma.customer.update({
        where: { id },
        data: {
          status: "archived",
          comments:
            cleanString(comments) ||
            existingCustomer.comments ||
            "Customer archived",
          updated_by: loggedInUserId,
        },
        include: customerInclude,
      });
  
      return res.status(200).json({
        message: "Customer archived successfully",
        customer,
      });
    } catch (error) {
      console.error("Archive customer error:", error);
  
      return res.status(500).json({
        message: "Failed to archive customer",
        error: error.message,
      });
    }
  };

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    convertLeadToCustomer,
    updateCustomerStatus,
    archiveCustomer,
};