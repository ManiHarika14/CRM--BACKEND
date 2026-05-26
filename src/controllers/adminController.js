const bcrypt = require("bcryptjs");

const prisma = require("../utils/prisma");



// CREATE ADMIN
const createAdmin = async (req, res) => {

  try {

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
          status: "active",
        },
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

    const { id } = req.params;

    const {
      name,
      email,
      status,
    } = req.body;

    const updatedAdmin =
      await prisma.user.update({
        where: {
          user_id: Number(id),
        },
        data: {
          name,
          email,
          status,
        },
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

    const { id } = req.params;

    await prisma.user.delete({
      where: {
        user_id: Number(id),
      },
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