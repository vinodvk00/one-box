import { Router, Request, Response } from 'express';
import { addTrainingData, createTrainingIndex } from '../../services/rag-suggestion-services/vector-store.service';
import { TrainingData } from '../../services/rag-suggestion-services/vector-store.service';

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
router.post('/', async (req: Request, res: Response) => {
    try {
        await createTrainingIndex();
        const trainingData: TrainingData = req.body;
        await addTrainingData(trainingData);
        res.json({ message: 'Training data added successfully' });
    } catch (error) {
        console.error('Failed to add training data:', error);
        res.status(500).json({ error: 'Failed to add training data' });
    }
});

export default router;