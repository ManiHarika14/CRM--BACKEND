const bcrypt = require("bcryptjs");

const prisma = require("../utils/prisma");

const {
  createActivity,
} = require("../utils/activityLogger");



// CREATE ADMIN
const createAdmin = async (req, res) => {

  try {

    // ONLY SUPER ADMIN CAN CREATE ADMINS
    if (req.user.role !== "super_admin") {

      return res.status(403).json({
        success: false,
        message: "Only Super Admin can create admins",
      });

    }

    const {
      name,
      email,
      password,
    } = req.body;

    // CHECK EXISTING ADMIN
    const existingAdmin =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingAdmin) {

      return res.status(400).json({
        success: false,
        message: "Admin already exists",
      });

    }

    // HASH PASSWORD
    const hashedPassword =
      await bcrypt.hash(password, 10);

    // CREATE ADMIN
    const admin =
      await prisma.user.create({
        data: {
          name,
          email,
          password_hash: hashedPassword,
          role: "admin",
          status: 1,
        },
      });

    // ACTIVITY LOG
    await createActivity({
      entity_type: "USER",
      entity_id: admin.user_id,
      action: "CREATE_ADMIN",
      description: `Super Admin created admin ${admin.email}`,
    });

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: admin,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });

  }

};



// GET ALL ADMINS
const getAdmins = async (req, res) => {

  try {

    // ONLY SUPER ADMIN CAN VIEW ADMINS
    if (req.user.role !== "super_admin") {

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });

    }

    const admins =
      await prisma.user.findMany({
        where: {
          role: "admin",
        },
        orderBy: {
          user_id: "desc",
        },
      });

    res.status(200).json({
      success: true,
      data: admins,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });

  }

};



// UPDATE ADMIN
const updateAdmin = async (req, res) => {

  try {

    // ONLY SUPER ADMIN
    if (req.user.role !== "super_admin") {

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });

    }

    const { id } = req.params;

    const {
      name,
      email,
      status,
    } = req.body;

    const updatedAdmin =
      await prisma.user.update({
        where: {
          user_id: id,
        },
        data: {
          name,
          email,
          status: status !== undefined ? Number(status) : undefined,
        },
      });

    // ACTIVITY LOG
    await createActivity({
      entity_type: "USER",
      entity_id: updatedAdmin.user_id,
      action: "UPDATE_ADMIN",
      description: `Super Admin updated admin ${updatedAdmin.email}`,
    });

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: updatedAdmin,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });

  }

};



// DELETE ADMIN
const deleteAdmin = async (req, res) => {

  try {

    // ONLY SUPER ADMIN
    if (req.user.role !== "super_admin") {

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
      });

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
      description: `Super Admin deleted admin ${admin?.email}`,
    });

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });

  }

};



module.exports = {
  createAdmin,
  getAdmins,
  updateAdmin,
  deleteAdmin,
};