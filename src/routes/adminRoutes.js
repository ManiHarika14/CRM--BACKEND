const express = require("express");

const router = express.Router();

const {
  protect,
} = require("../middlewares/authMiddleware");

const {
  createAdmin,
  getAdmins,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/adminController");

router.post(
  "/",
  protect,
  createAdmin
);

router.get(
  "/",
  protect,
  getAdmins
);

router.put(
  "/:id",
  protect,
  updateAdmin
);

router.delete(
  "/:id",
  protect,
  deleteAdmin
);

module.exports = router;