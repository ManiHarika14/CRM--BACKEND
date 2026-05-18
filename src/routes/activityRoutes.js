const express = require("express");

const {
  getActivities,
  getActivityById,
} = require("../controllers/activityController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Activities
 *   description: CRM activity timeline APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Activity:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "a8b7c6d5-1234-4e9f-9b88-7c6d5e4f3a21"
 *         entity_type:
 *           type: string
 *           example: "deal"
 *           enum:
 *             - lead
 *             - customer
 *             - deal
 *             - task
 *             - note
 *         entity_id:
 *           type: string
 *           example: "d2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *         action:
 *           type: string
 *           example: "deal_status_updated"
 *         description:
 *           type: string
 *           example: "Deal status changed from proposal to won."
 *         lead_id:
 *           type: string
 *           nullable: true
 *           example: "b2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d111"
 *         customer_id:
 *           type: string
 *           nullable: true
 *           example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *         deal_id:
 *           type: string
 *           nullable: true
 *           example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *         task_id:
 *           type: string
 *           nullable: true
 *           example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *         note_id:
 *           type: string
 *           nullable: true
 *           example: "b1a7d9c4-8a2e-4e7b-8c91-6f3a22e4a111"
 *         created_by:
 *           type: string
 *           nullable: true
 *           example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Get all activity timeline records
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch CRM activity timeline records with optional filters. Activities are read-only and are created automatically by the system.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "deal"
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *           enum:
 *             - lead
 *             - customer
 *             - deal
 *             - task
 *             - note
 *         example: "deal"
 *       - in: query
 *         name: entity_id
 *         schema:
 *           type: string
 *         example: "d2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         example: "deal_status_updated"
 *       - in: query
 *         name: lead_id
 *         schema:
 *           type: string
 *         example: "b2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d111"
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *         example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *       - in: query
 *         name: deal_id
 *         schema:
 *           type: string
 *         example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *       - in: query
 *         name: task_id
 *         schema:
 *           type: string
 *         example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *       - in: query
 *         name: note_id
 *         schema:
 *           type: string
 *         example: "b1a7d9c4-8a2e-4e7b-8c91-6f3a22e4a111"
 *       - in: query
 *         name: created_by
 *         schema:
 *           type: string
 *         example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
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
 *         description: Activities fetched successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, getActivities);

/**
 * @swagger
 * /api/activities/{id}:
 *   get:
 *     summary: Get activity by ID
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch a single activity timeline record by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "a8b7c6d5-1234-4e9f-9b88-7c6d5e4f3a21"
 *     responses:
 *       200:
 *         description: Activity fetched successfully
 *       400:
 *         description: Invalid activity id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Activity not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, getActivityById);

module.exports = router;