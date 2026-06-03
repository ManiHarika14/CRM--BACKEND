const prisma = require("../utils/prisma");

const CUSTOMER_TYPES = ["Customer", "Vendor", "BConsultant", "AlliedSP"];

// crm1_customers.status is Int: 1=active, 0=inactive
const CUSTOMER_STATUS_MAP = { active: 1, inactive: 0 };
const CUSTOMER_STATUS_VALUES = Object.keys(CUSTOMER_STATUS_MAP);

const LEAD_ALLOWED_VERIFICATION_STATUS = "verified";
const LEAD_ALLOWED_CONVERSION_STAGE = "qualified";

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

// New crm1_customers only has: i_id, id, name, email, customer_type, status
const validateCustomerPayload = (body, mode = "create") => {
  const errors = [];
  const { customer_type, status, name, email } = body;

  if (mode === "create") {
    if (!customer_type) {
      errors.push("customer_type is required");
    }
    if (!cleanString(name) && !cleanString(email)) {
      errors.push("At least one of name or email is required");
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

  if (name && name.length > 150) {
    errors.push("Name cannot exceed 150 characters");
  }

  if (email && email.length > 150) {
    errors.push("Email cannot exceed 150 characters");
  }

  return errors;
};

const buildCustomerData = (body) => {
  const data = {};

  // name is NOT NULL in DB — only set if provided
  if (body.name !== undefined) data.name = cleanString(body.name);
  if (body.customer_type !== undefined) data.customer_type = cleanString(body.customer_type);
  if (body.email !== undefined) data.email = body.email ? cleanString(body.email).toLowerCase() : null;
  if (body.status !== undefined) data.status = CUSTOMER_STATUS_MAP[body.status] ?? 1;

  return data;
};

// CREATE CUSTOMER
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

    const { email } = req.body;

    if (email) {
      const existing = await prisma.customer.findFirst({
        where: { email: cleanString(email).toLowerCase() },
      });
      if (existing) {
        return res.status(409).json({
          message: "A customer with this email already exists",
          existing_customer_id: existing.id,
        });
      }
    }

    const customer = await prisma.customer.create({
      data: buildCustomerData(req.body),
    });
    await prisma.customer_Properties.create({
  data: {
    id: customer.id,
    email: req.body.email || null,
    phone: req.body.phone || null,
    address: req.body.address || null,
    company_name: req.body.company_name || null,
    website: req.body.website || null,
    contact_info: req.body.contact_info || null,
  },
});
   await prisma.customer_Log.create({
  data: {
    id: customer.id,
    user_id: req.user.user_id,
    log_type_id: 1,
  },
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
      return res.status(400).json({ message: "Page must be a positive number" });
    }

    if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      return res.status(400).json({ message: "Limit must be between 1 and 100" });
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

    if (customer_type) where.customer_type = customer_type;
    if (status !== undefined) where.status = CUSTOMER_STATUS_MAP[status];

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      where.OR = [
        { name: { contains: cleanSearch, mode: "insensitive" } },
        { email: { contains: cleanSearch, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,

        include: {
          properties: true,
          
          customer_logs: {
            orderBy: {
              date_time: "desc",
            },
            take: 1,

            include: {
              user: true,
            },
          },
        },
        orderBy: {
          i_id : "desc",
        },
        skip,
        take: limitNumber,
      }),
      prisma.customer.count({ where }),
    ]);
    console.log(JSON.stringify(customers, null, 2));
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
      return res.status(400).json({ message: "Invalid customer id" });
    }

    const customer = await prisma.customer.findUnique({ 
      where: { id },
      
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
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
      return res.status(400).json({ message: "Invalid customer id" });
    }

    const validationErrors = validateCustomerPayload(req.body, "update");

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });

    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const { email } = req.body;

    if (email) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          id: { not: id },
          email: cleanString(email).toLowerCase(),
        },
      });
      if (duplicate) {
        return res.status(409).json({
          message: "Another customer already exists with this email",
          existing_customer_id: duplicate.id,
        });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: buildCustomerData(req.body),
    });
    console.log("Customer Updated:", customer.id);
    await prisma.customer_Log.create({
  data: {
    id: customer.id,
    user_id: req.user.user_id,
    log_type_id: 2,
  },
});
console.log("Customer Log Created");

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

    if (!loggedInUserId || !isValidUUID(loggedInUserId)) {
      return res.status(401).json({
        message: "Unauthorized. Valid logged-in user is required.",
      });
    }

    if (!isValidUUID(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (lead.customer_id) {
      return res.status(400).json({
        message: "This lead is already converted to a customer",
        customer_id: lead.customer_id,
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

    const { customer_type } = req.body;

    if (!customer_type || !CUSTOMER_TYPES.includes(customer_type)) {
      return res.status(400).json({
        message: "customer_type is required for conversion",
        allowed_types: CUSTOMER_TYPES,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdCustomer = await tx.customer.create({
        data: { customer_type, status: 1 },
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
    const { status } = req.body;

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
      data: { status: CUSTOMER_STATUS_MAP[status] },
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
