const prisma = require("./prisma");

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

const getRequestIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
};

const getUserAgent = (req) => {
  return req.headers["user-agent"] || null;
};

// log_type_id mapping for crm1_auth_logs:
const ACTION_TO_LOG_TYPE = {
  login_success: 1,
  login_failed: 2,
  user_registered: 3,
  account_inactive_login_attempt: 4,
};

const createAuthLog = async ({
  req,
  user_id,
  action,
}) => {
  try {
    const cleanAction = cleanString(action);

    if (!cleanAction) {
      console.error("Auth logging skipped: action is required");
      return null;
    }

    if (!user_id || !isValidUUID(user_id)) {
      // crm1_auth_logs requires a valid user_id (non-nullable FK)
      console.error("Auth logging skipped: valid user_id is required");
      return null;
    }

    const log_type_id = ACTION_TO_LOG_TYPE[cleanAction] ?? 0;

    const authLog = await prisma.authLog.create({
      data: {
        user_id: String(user_id).trim(),
        log_type_id,
      },
    });

    return authLog;
  } catch (error) {
    console.error("Create auth log error:", error);
    return null;
  }
};

module.exports = {
  createAuthLog,
};