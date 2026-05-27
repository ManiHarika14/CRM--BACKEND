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
 *         i_id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: string
 *           example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *         log_type_id:
 *           type: integer
 *           example: 1
 *           description: "1=login_success, 2=login_failed, 3=user_registered, 4=account_inactive_login_attempt"
 *         date_time:
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
 *         name: log_type_id
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3, 4]
 *         description: "1=login_success, 2=login_failed, 3=user_registered, 4=account_inactive_login_attempt"
 *         example: 1
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
 *           type: integer
 *         example: 1
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