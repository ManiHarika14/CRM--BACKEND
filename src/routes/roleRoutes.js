const express = require("express");
const {
  createRole,
  getRoles,
  assignRole,
  addPermission,
  getRolePermissions,
} = require("../controllers/roleController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_name
 *             properties:
 *               role_name:
 *                 type: string
 *                 example: CRM1_USER
 *               description:
 *                 type: string
 *                 example: Lead Viewer Role
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.post("/", protect, createRole);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 */
router.get("/", protect, getRoles);

/**
 * @swagger
 * /api/roles/assign:
 *   post:
 *     summary: Assign role to user
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - role_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *               role_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Role assigned successfully
 */
router.post("/assign", protect, assignRole);

/**
 * @swagger
 * /api/roles/{roleId}/permissions:
 *   post:
 *     summary: Add permission to a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resource
 *               - access_type
 *             properties:
 *               resource:
 *                 type: string
 *               access_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Permission added successfully
 */
router.post("/:roleId/permissions", protect, addPermission);

/**
 * @swagger
 * /api/roles/{roleId}/permissions:
 *   get:
 *     summary: Get permissions for a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: List of permissions for the role
 */
router.get("/:roleId/permissions", protect, getRolePermissions);

module.exports = router;