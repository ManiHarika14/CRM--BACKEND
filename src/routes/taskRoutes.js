const express = require("express");

const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require("../controllers/taskController");

const { protect } = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: CRM task and follow-up management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *         customer_id:
 *           type: string
 *           example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *         deal_id:
 *           type: string
 *           nullable: true
 *           example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *         assigned_to:
 *           type: string
 *           example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *         title:
 *           type: string
 *           example: "Follow up with customer"
 *         description:
 *           type: string
 *           example: "Call the customer and confirm if they accepted the proposal."
 *         status:
 *           type: string
 *           example: "pending"
 *           enum:
 *             - pending
 *             - in_progress
 *             - completed
 *             - cancelled
 *         priority:
 *           type: string
 *           example: "medium"
 *           enum:
 *             - low
 *             - medium
 *             - high
 *             - urgent
 *         due_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-05-20T10:00:00.000Z"
 *         comment:
 *           type: string
 *           example: "Task created after deal proposal was sent."
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
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Create a CRM follow-up task for a customer. A task can optionally be linked to a deal.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - assigned_to
 *               - title
 *             properties:
 *               customer_id:
 *                 type: string
 *                 example: "c7a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *               deal_id:
 *                 type: string
 *                 nullable: true
 *                 example: "e4b3f7c2-2c44-4db8-baa3-44b62b66d999"
 *               assigned_to:
 *                 type: string
 *                 example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *               title:
 *                 type: string
 *                 example: "Follow up with customer"
 *               description:
 *                 type: string
 *                 example: "Call the customer and confirm if they accepted the proposal."
 *               status:
 *                 type: string
 *                 example: "pending"
 *                 enum:
 *                   - pending
 *                   - in_progress
 *                   - completed
 *                   - cancelled
 *               priority:
 *                 type: string
 *                 example: "medium"
 *                 enum:
 *                   - low
 *                   - medium
 *                   - high
 *                   - urgent
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-20T10:00:00.000Z"
 *               comment:
 *                 type: string
 *                 example: "Task created after proposal was sent."
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer, deal, or assigned user not found
 *       500:
 *         description: Internal server error
 */
router.post("/", protect, checkPermission("task", "creator"), createTask);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all tasks
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch tasks with optional search, status, priority, customer, deal, assigned user, and pagination filters.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "follow up"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - pending
 *             - in_progress
 *             - completed
 *             - cancelled
 *         example: "pending"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum:
 *             - low
 *             - medium
 *             - high
 *             - urgent
 *         example: "high"
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
 *         name: assigned_to
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
 *         description: Tasks fetched successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, checkPermission("task", "viewer"), getTasks);

/**
 * @swagger
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Update task status
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Update the task status such as pending, in_progress, completed, or cancelled.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: "completed"
 *                 enum:
 *                   - pending
 *                   - in_progress
 *                   - completed
 *                   - cancelled
 *               comment:
 *                 type: string
 *                 example: "Customer was contacted and task is completed."
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/status", protect, checkPermission("task", "editor"), updateTaskStatus);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch a single task by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *     responses:
 *       200:
 *         description: Task fetched successfully
 *       400:
 *         description: Invalid task id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, checkPermission("task", "viewer"), getTaskById);

/**
 * @swagger
 * /api/tasks/{id}:
 *   patch:
 *     summary: Update task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Update task details including customer, deal, assigned user, title, description, status, priority, due date, or comment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
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
 *               assigned_to:
 *                 type: string
 *                 example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *               title:
 *                 type: string
 *                 example: "Follow up with customer again"
 *               description:
 *                 type: string
 *                 example: "Customer requested another call tomorrow."
 *               status:
 *                 type: string
 *                 example: "in_progress"
 *                 enum:
 *                   - pending
 *                   - in_progress
 *                   - completed
 *                   - cancelled
 *               priority:
 *                 type: string
 *                 example: "urgent"
 *                 enum:
 *                   - low
 *                   - medium
 *                   - high
 *                   - urgent
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-05-21T12:00:00.000Z"
 *               comment:
 *                 type: string
 *                 example: "Task updated after customer response."
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task, customer, deal, or assigned user not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", protect, checkPermission("task", "editor"), updateTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a task permanently from the database.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d7d4b3d6-8a0e-4a5c-91f7-3bb5c2b4d7a1"
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       400:
 *         description: Invalid task id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", protect, checkPermission("task", "deleter"), deleteTask);

module.exports = router;