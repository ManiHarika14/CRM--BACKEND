const prisma = require("../utils/prisma");

const CUSTOMER_TYPES = ["Customer", "Vendor", "BConsultant", "AlliedSP"];

// crm1_customers.status is Int: 1=active, 0=inactive
const CUSTOMER_STATUS_MAP = { active: 1, inactive: 0 };
const CUSTOMER_STATUS_VALUES = Object.keys(CUSTOMER_STATUS_MAP);

const LEAD_ALLOWED_VERIFICATION_STATUS = "verified";
const LEAD_ALLOWED_CONVERSION_STAGE = "qualified";

const BLOCKED_LEAD_STATUSES = ["not_interested", "churned"];
const BLOCKED_LEAD_STAGES = ["lost"];

const isValidUUID = (value) => {
  if (!value) return false;
  const uuid = String(value).trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
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

const customerInclude = {
  // include minimal/available relations
  crm1_leads: true,
  deals: true,
  notes: true,
  tasks: true,
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

  if (status !== undefined && !CUSTOMER_STATUS_VALUES.includes(status)) {
    errors.push(
      `Invalid status. Allowed values: ${CUSTOMER_STATUS_VALUES.join(", ")}`
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

  return errors;
};

const buildCustomerData = (body) => {
  const data = {
    customer_type: cleanString(body.customer_type),
    name: cleanString(body.name),
    email: body.email ? cleanString(body.email).toLowerCase() : null,
    phone: cleanString(body.phone),
    address: cleanString(body.address),
    company_name: cleanString(body.company_name),
    website: cleanString(body.website),
    contact_info: cleanString(body.contact_info),
  };

  if (body.status !== undefined) {
    data.status = CUSTOMER_STATUS_MAP[body.status] ?? 1;
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
      data: buildCustomerData(req.body),
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

    if (status !== undefined && !CUSTOMER_STATUS_VALUES.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
        allowed_statuses: CUSTOMER_STATUS_VALUES,
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const where = {};

    if (customer_type) {
      where.customer_type = customer_type;
    }

    if (status !== undefined) {
      where.status = CUSTOMER_STATUS_MAP[status];
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
          i_id: "desc",
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
      data: buildCustomerData(req.body),
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

// CONVERT LEAD TO CUSTOMER (keeps original behavior)
const convertLeadToCustomer = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { leadId } = req.params;

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

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { crm1_customers: true },
    });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    if (lead.crm1_customers) {
      return res.status(400).json({
        message: "This lead is already converted to a customer",
        customer_id: lead.crm1_customers.id,
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
        message: "Only verified leads can be converted to a customer",
        current_verification_status: lead.verification_status,
      });
    }

    if (lead.crm_stage !== LEAD_ALLOWED_CONVERSION_STAGE) {
      return res.status(400).json({
        message: "Only qualified leads can be converted. Lost leads are not eligible.",
        current_crm_stage: lead.crm_stage,
      });
    }

    // New Lead has no name/email/phone fields — customer_type must come from request body
    const { customer_type } = req.body;

    if (!customer_type || !CUSTOMER_TYPES.includes(customer_type)) {
      return res.status(400).json({
        message: "customer_type is required for conversion",
        allowed_types: CUSTOMER_TYPES,
      });
    }

    const customerData = {
      customer_type,
      status: 1,
    };

    const result = await prisma.$transaction(async (tx) => {
      const createdCustomer = await tx.customer.create({
        data: customerData,
      });

      await tx.lead.update({
        where: { id: leadId },
        data: {
          customer_id: createdCustomer.id,
          crm_stage: "converted",
        },
      });

      return createdCustomer;
    });

    return res.status(201).json({
      message: "Lead converted to customer successfully",
      customer_id: result.id,
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
      return res.status(401).json({ message: "Unauthorized. Valid logged-in user is required." });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({ message: "Invalid customer id" });
    }

    if (!status || !CUSTOMER_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ message: "Invalid status", allowed_statuses: CUSTOMER_STATUS_VALUES });
    }

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });

    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        status: CUSTOMER_STATUS_MAP[status],
      },
      include: customerInclude,
    });

    return res.status(200).json({ message: "Customer status updated successfully", customer: updated });
  } catch (error) {
    console.error("Update customer status error:", error);
    return res.status(500).json({ message: "Failed to update customer status", error: error.message });
  }
};

// ARCHIVE CUSTOMER (soft-delete)
const archiveCustomer = async (req, res) => {
  try {
    const loggedInUserId = getLoggedInUserId(req);
    const { id } = req.params;

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({ message: "Unauthorized. Valid logged-in user is required." });
    }

    if (!isValidUUID(id)) {
      return res.status(400).json({ message: "Invalid customer id" });
    }

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });

    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (existingCustomer.status === 0) {
      return res.status(400).json({ message: "Customer is already inactive" });
    }

    await prisma.customer.update({
      where: { id },
      data: { status: 0 },
    });

    return res.status(200).json({ message: "Customer deactivated successfully" });
  } catch (error) {
    console.error("Archive customer error:", error);
    return res.status(500).json({ message: "Failed to archive customer", error: error.message });
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
