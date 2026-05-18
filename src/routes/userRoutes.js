const express = require("express");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const { protect, allowRoles } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management APIs
 */

router.use(protect);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get users for CRM dropdowns and user management
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch users for frontend dropdowns such as assigned_to. By default, the controller returns active users only. password_hash is never returned.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         example: "active"
 *         description: Filter users by status. Defaults to active.
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         example: "admin"
 *         description: Optional role filter.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "admin"
 *         description: Search by name, email, or role.
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error while fetching users
 */
router.get("/", allowRoles("admin", "super_admin"), getUsers);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Create a new CRM user. password_hash is not returned.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Admin User"
 *               email:
 *                 type: string
 *                 example: "admin@testing.com"
 *               password:
 *                 type: string
 *                 example: "Password123"
 *               role:
 *                 type: string
 *                 example: "admin"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: User already exists with this email
 *       500:
 *         description: Server error while creating user
 */
router.post("/", allowRoles("admin", "super_admin"), createUser);

/**
 * @swagger
 * /api/users/{user_id}:
 *   patch:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Update user details such as name, email, role, or status.
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Admin"
 *               email:
 *                 type: string
 *                 example: "updated.admin@testing.com"
 *               role:
 *                 type: string
 *                 example: "admin"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       200:
 *         description: User updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error while updating user
 */
router.patch("/:user_id", allowRoles("admin", "super_admin"), updateUser);

/**
 * @swagger
 * /api/users/{user_id}:
 *   delete:
 *     summary: Deactivate a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Deactivate a user by setting status to inactive. This does not hard delete the user.
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error while deactivating user
 */
router.delete("/:user_id", allowRoles("admin", "super_admin"), deleteUser);

module.exports = router;