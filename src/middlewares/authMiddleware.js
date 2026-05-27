const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const env = require("../config/env");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: {
        user_id: decoded.user_id,
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found",
      });
    }

    if (user.status !== 1) {
      return res.status(403).json({
        success: false,
        message: "User account is not active",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error);
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  };
};

module.exports = {
  protect,
  allowRoles,
};