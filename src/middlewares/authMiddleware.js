const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { JwtExpiredError } = require("aws-jwt-verify/error");
const prisma = require("../utils/prisma");
const env = require("../config/env");

const verifier = CognitoJwtVerifier.create({
  userPoolId: env.COGNITO_USER_POOL_ID,
  clientId: env.COGNITO_CLIENT_ID,
  tokenUse: "access",
});

const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.crm_token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, token missing" });
    }

    const payload = await verifier.verify(token);

    const user = await prisma.user.findFirst({
      where: { cognito_sub: payload.sub },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Not authorized, user not found" });
    }

    if (user.status !== 1) {
      return res.status(403).json({ success: false, message: "User account is not active" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof JwtExpiredError) {
      return res.status(401).json({ success: false, code: "TOKEN_EXPIRED", message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Not authorized, token failed" });
  }
};

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
};

module.exports = { protect, allowRoles };
