const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");

const getUsers = async (req, res) => {
  try {
    const { status = "active", role, search } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim();

      where.OR = [
        {
          name: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
        {
          role: {
            contains: cleanSearch,
            mode: "insensitive",
          },
        },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching users",
    });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, status } = req.body;

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
        status: status || "active",
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { name, email, role, status } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { user_id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: {
        name,
        email,
        role,
        status,
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updated_at: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating user",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { user_id },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await prisma.user.update({
      where: { user_id },
      data: {
        status: "inactive",
      },
    });

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deactivating user",
    });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};