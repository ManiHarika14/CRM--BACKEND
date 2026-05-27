
const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const generateToken = require("../utils/generateToken");
const { createAuthLog } = require("../utils/authLogger");

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: role || null,
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        
      },
    });

    await createAuthLog({
      req,
      user_id: user.user_id,
      action: "user_registered",
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await createAuthLog({
        req,
        user_id: null,
        action: "login_failed",
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== 1) {
      await createAuthLog({
        req,
        user_id: user.user_id,
        action: "account_inactive_login_attempt",
      });

      return res.status(403).json({
        success: false,
        message: "User account is not active",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isPasswordCorrect) {
      await createAuthLog({
        req,
        user_id: user.user_id,
        action: "login_failed",
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    await createAuthLog({
      req,
      user_id: user.user_id,
      action: "login_success",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

const me = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  me,
};