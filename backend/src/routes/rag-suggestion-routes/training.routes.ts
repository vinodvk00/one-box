import { Router } from 'express';
import { addTrainingData } from '../../controllers/rag-suggestion/training.controller';

const router = Router();

/**
 * @openapi
 * /api/training:
 *   post:
 *     tags:
 *       - Training
 *     summary: Add training data for reply suggestions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenario:
 *                 type: string
 *                 example: "Job application follow-up"
 *               context:
 *                 type: string
 *                 example: "I am applying for a job position. If the lead is interested, share the meeting booking link: https://cal.com/example"
 *               response_template:
 *                 type: string
 *                 example: "Thank you for your interest! I'm available for an interview. You can book a slot here: https://cal.com/example"
 *     responses:
 *       '200':
 *         description: Training data added successfully
 *       '500':
 *         description: Server error
 */
router.post('/', addTrainingData);

export default router;