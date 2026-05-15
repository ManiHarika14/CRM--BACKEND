const express = require("express");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const { protect, allowRoles } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", allowRoles("admin", "super_admin"), getUsers);
router.post("/", allowRoles("admin", "super_admin"), createUser);
router.patch("/:user_id", allowRoles("admin", "super_admin"), updateUser);
router.delete("/:user_id", allowRoles("admin", "super_admin"), deleteUser);

module.exports = router;