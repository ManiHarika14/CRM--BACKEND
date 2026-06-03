const express = require("express");

const router = express.Router();

const {
  protect,
} = require("../middlewares/authMiddleware");

const {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/adminController");

// CREATE ADMIN
router.post(
  "/",
  protect,
  createAdmin
);

// GET ALL ADMINS
router.get(
  "/",
  protect,
  getAdmins
);

// GET ADMIN BY ID
router.get(
  "/:id",
  protect,
  getAdminById
);

// UPDATE ADMIN
router.put(
  "/:id",
  protect,
  updateAdmin
);

// DELETE ADMIN
router.delete(
  "/:id",
  protect,
  deleteAdmin
);

module.exports = router;