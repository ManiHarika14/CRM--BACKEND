const express = require("express");

const {
  getAuthLogs,
  getAuthLogById,
} = require("../controllers/authLogController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth Logs
 *   description: Authentication and security audit log APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "a8b7c6d5-1234-4e9f-9b88-7c6d5e4f3a21"
 *         user_id:
 *           type: string
 *           nullable: true
 *           example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "test@example.com"
 *         action:
 *           type: string
 *           example: "login_success"
 *           enum:
 *             - user_registered
 *             - login_success
 *             - login_failed
 *             - account_inactive_login_attempt
 *         status:
 *           type: string
 *           example: "success"
 *           enum:
 *             - success
 *             - failed
 *             - blocked
 *         description:
 *           type: string
 *           nullable: true
 *           example: "User logged in successfully"
 *         ip_address:
 *           type: string
 *           nullable: true
 *           example: "::1"
 *         user_agent:
 *           type: string
 *           nullable: true
 *           example: "Mozilla/5.0"
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/auth-logs:
 *   get:
 *     summary: Get all authentication logs
 *     tags: [Auth Logs]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch authentication and security audit logs with optional filters.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "login"
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         example: "test@example.com"
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum:
 *             - user_registered
 *             - login_success
 *             - login_failed
 *             - account_inactive_login_attempt
 *         example: "login_success"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - success
 *             - failed
 *             - blocked
 *         example: "success"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Auth logs fetched successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, getAuthLogs);

/**
 * @swagger
 * /api/auth-logs/{id}:
 *   get:
 *     summary: Get authentication log by ID
 *     tags: [Auth Logs]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch a single authentication/security audit log by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "a8b7c6d5-1234-4e9f-9b88-7c6d5e4f3a21"
 *     responses:
 *       200:
 *         description: Auth log fetched successfully
 *       400:
 *         description: Invalid auth log id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Auth log not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, getAuthLogById);

module.exports = router;