const bcrypt = require("bcryptjs");
const prisma = require("../utils/prisma");
const {
  createActivity,
} = require("../utils/activityLogger");

// VALIDATE EMAIL FORMAT
const isValidEmail = (email) => {
  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// VALIDATE PASSWORD STRENGTH
const isValidPassword = (password) => {
  return (
    password &&
    password.length >= 6
  );
};

// CREATE ADMIN
const createAdmin = async (req, res) => {
  try {
    // ONLY SUPER ADMIN CAN CREATE ADMINS
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can create admins",
      });
    }

    const {
      name,
      email,
      password,
    } = req.body;

    // VALIDATE INPUT
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (
      !isValidEmail(email)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email format",
      });
    }

    if (
      !isValidPassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    // CHECK EXISTING ADMIN
    const existingAdmin =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message:
          "Admin already exists with this email",
      });
    }

    // HASH PASSWORD
    const hashedPassword =
      await bcrypt.hash(password, 10);

    // CREATE ADMIN
    const admin =
      await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.trim()
            .toLowerCase(),
          password_hash:
            hashedPassword,
          role: "admin",
          status: 1,
        },
      });

    // ACTIVITY LOG
    await createActivity({
      entity_type: "USER",
      entity_id: admin.user_id,
      action: "CREATE_ADMIN",
      description: `Super Admin ${req.user.email} created admin ${admin.email}`,
    });

    res.status(201).json({
      success: true,
      message:
        "Admin created successfully",
      data: {
        user_id: admin.user_id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error(
      "CREATE ADMIN ERROR:",
      error
    );
    res.status(500).json({
      success: false,
      message:
        "Server error while creating admin",
    });
  }
};

// GET ALL ADMINS
const getAdmins = async (req, res) => {
  try {
    // ONLY SUPER ADMIN CAN VIEW ADMINS
    if (
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can view admins",
      });
    }

    const admins =
      await prisma.user.findMany({
        where: {
          role: "admin",
        },
        select: {
          user_id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
        orderBy: {
          user_id: "desc",
        },
      });

    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins,
    });
  } catch (error) {
    console.error(
      "GET ADMINS ERROR:",
      error
    );
    res.status(500).json({
      success: false,
      message:
        "Server error while fetching admins",
    });
  }
};

// GET ADMIN BY ID
const getAdminById = async (req, res) => {
  try {
    if (
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { id } = req.params;

    const admin =
      await prisma.user.findUnique({
        where: {
          user_id: id,
        },
        select: {
          user_id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error(
      "GET ADMIN ERROR:",
      error
    );
    res.status(500).json({
      success: false,
      message:
        "Server error while fetching admin",
    });
  }
};

// UPDATE ADMIN
const updateAdmin = async (req, res) => {
  try {
    // ONLY SUPER ADMIN
    if (
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can update admins",
      });
    }

    const { id } = req.params;
    const {
      name,
      email,
      status,
    } = req.body;

    // CHECK IF ADMIN EXISTS
    const admin =
      await prisma.user.findUnique({
        where: {
          user_id: id,
        },
      });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // PREVENT CHANGING ROLE
    if (admin.role !== "admin") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot modify non-admin users",
      });
    }

    // VALIDATE NAME
    if (
      name !== undefined &&
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty",
      });
    }

    // VALIDATE EMAIL
    if (
      email !== undefined &&
      email !== admin.email
    ) {
      if (!email.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Email cannot be empty",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid email format",
        });
      }

      // CHECK EMAIL UNIQUENESS
      const existingAdmin =
        await prisma.user.findUnique(
          {
            where: {
              email: email
                .trim()
                .toLowerCase(),
            },
          }
        );

      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message:
            "Email already in use",
        });
      }
    }

    // BUILD UPDATE DATA
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (email !== undefined) {
      updateData.email = email
        .trim()
        .toLowerCase();
    }

    if (status !== undefined) {
      updateData.status =
        Number(status);
    }

    // UPDATE ADMIN
    const updatedAdmin =
      await prisma.user.update({
        where: {
          user_id: id,
        },
        data: updateData,
        select: {
          user_id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });

    // ACTIVITY LOG
    await createActivity({
      entity_type: "USER",
      entity_id: id,
      action: "UPDATE_ADMIN",
      description: `Super Admin ${req.user.email} updated admin ${updatedAdmin.email}`,
    });

    res.status(200).json({
      success: true,
      message:
        "Admin updated successfully",
      data: updatedAdmin,
    });
  } catch (error) {
    console.error(
      "UPDATE ADMIN ERROR:",
      error
    );
    res.status(500).json({
      success: false,
      message:
        "Server error while updating admin",
    });
  }
};

// DELETE ADMIN
const deleteAdmin = async (req, res) => {
  try {
    // ONLY SUPER ADMIN
    if (
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only Super Admin can delete admins",
      });
    }

    const { id } = req.params;

    // PREVENT SELF-DELETION
    if (id === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete your own account",
      });
    }

    // CHECK IF ADMIN EXISTS
    const admin =
      await prisma.user.findUnique({
        where: {
          user_id: id,
        },
      });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // PREVENT CHANGING ROLE
    if (admin.role !== "admin") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete non-admin users",
      });
    }

    // DELETE ADMIN
    await prisma.user.delete({
      where: {
        user_id: id,
      },
    });

    // ACTIVITY LOG
    await createActivity({
      entity_type: "USER",
      entity_id: id,
      action: "DELETE_ADMIN",
      description: `Super Admin ${req.user.email} deleted admin ${admin.email}`,
    });

    res.status(200).json({
      success: true,
      message:
        "Admin deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE ADMIN ERROR:",
      error
    );
    res.status(500).json({
      success: false,
      message:
        "Server error while deleting admin",
    });
  }
};

module.exports = {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
};