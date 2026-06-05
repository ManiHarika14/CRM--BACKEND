const express = require("express");

const {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
} = require("../controllers/noteController");

const { protect } = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Notes
 *   description: CRM notes management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Note:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "b1a7d9c4-8a2e-4e7b-8c91-6f3a22e4a111"
 *         customer_id:
 *           type: string
 *           example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *         deal_id:
 *           type: string
 *           nullable: true
 *           example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *         task_id:
 *           type: string
 *           nullable: true
 *           example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *         note:
 *           type: string
 *           example: "Customer prefers WhatsApp communication after 5 PM."
 *         created_by:
 *           type: string
 *           example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *         updated_by:
 *           type: string
 *           example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/notes:
 *   post:
 *     summary: Create a new note
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     description: Create a CRM note for a customer. A note can optionally be linked to a deal or task.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - note
 *             properties:
 *               customer_id:
 *                 type: string
 *                 example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *               deal_id:
 *                 type: string
 *                 nullable: true
 *                 example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *               task_id:
 *                 type: string
 *                 nullable: true
 *                 example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *               note:
 *                 type: string
 *                 example: "Customer prefers WhatsApp communication after 5 PM."
 *     responses:
 *       201:
 *         description: Note created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer, deal, or task not found
 *       500:
 *         description: Internal server error
 */
router.post("/", protect, checkPermission("note", "creator"), createNote);

/**
 * @swagger
 * /api/notes:
 *   get:
 *     summary: Get all notes
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch notes with optional search, customer, deal, task, created_by, and pagination filters.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "WhatsApp"
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
 *         example: 10
 *     responses:
 *       200:
 *         description: Notes fetched successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, checkPermission("note", "viewer"), getNotes);

/**
 * @swagger
 * /api/notes/{id}:
 *   get:
 *     summary: Get note by ID
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch a single note by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "b1a7d9c4-8a2e-4e7b-8c91-6f3a22e4a111"
 *     responses:
 *       200:
 *         description: Note fetched successfully
 *       400:
 *         description: Invalid note id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, checkPermission("note", "viewer"), getNoteById);

/**
 * @swagger
 * /api/notes/{id}:
 *   patch:
 *     summary: Update note
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     description: Update note details including customer, deal, task, or note text.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "b1a7d9c4-8a2e-4e7b-8c91-6f3a22e4a111"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_id:
 *                 type: string
 *                 example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *               deal_id:
 *                 type: string
 *                 nullable: true
 *                 example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *               task_id:
 *                 type: string
 *                 nullable: true
 *                 example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *               note:
 *                 type: string
 *                 example: "Customer requested a revised quotation and prefers WhatsApp follow-up."
 *     responses:
 *       200:
 *         description: Note updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note, customer, deal, or task not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", protect, checkPermission("note", "editor"), updateNote);

/**
 * @swagger
 * /api/notes/{id}:
 *   delete:
 *     summary: Delete note
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a note permanently from the database.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "b1a7d9c4-8a2e-4e7b-8c91-6f3a22e4a111"
 *     responses:
 *       200:
 *         description: Note deleted successfully
 *       400:
 *         description: Invalid note id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Note not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", protect, checkPermission("note", "deleter"), deleteNote);

module.exports = router;