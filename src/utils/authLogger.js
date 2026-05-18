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

const createAuthLog = async ({
  req,
  user_id,
  email,
  action,
  status,
  description,
}) => {
  try {
    const cleanEmail = cleanString(email);
    const cleanAction = cleanString(action);
    const cleanStatus = cleanString(status);
    const cleanDescription = cleanString(description);

    if (!cleanAction) {
      console.error("Auth logging skipped: action is required");
      return null;
    }

    if (!cleanStatus) {
      console.error("Auth logging skipped: status is required");
      return null;
    }

    const authLog = await prisma.authLog.create({
      data: {
        user_id:
          user_id && isValidUUID(user_id) ? String(user_id).trim() : null,
        email: cleanEmail ? cleanEmail.toLowerCase() : null,
        action: cleanAction,
        status: cleanStatus,
        description: cleanDescription,
        ip_address: req ? getRequestIp(req) : null,
        user_agent: req ? getUserAgent(req) : null,
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