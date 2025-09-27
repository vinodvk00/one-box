import { Router, Request, Response } from 'express';
import { getEmailById, type EmailDocument } from '../../services/elasticsearch.service';
import { generateReplySuggestion } from '../../services/rag-suggestion-services/reply-suggestion.service';

const router = Router();

/**
 * @openapi
 * /api/emails/{id}/suggest-reply:
 *   get:
 *     tags:
 *       - Reply Suggestions
 *     summary: Get AI-suggested reply for an email
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Email ID
 *     responses:
 *       '200':
 *         description: Reply suggestion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestion:
 *                   type: string
 *                 confidence:
 *                   type: number
 *                 relevantContext:
 *                   type: array
 *                   items:
 *                     type: string
 *       '404':
 *         description: Email not found
 *       '500':
 *         description: Server error
 */
router.get('/:id/suggest-reply', async (req: Request, res: Response) => {
    try {
        const email = await getEmailById(req.params.id) as EmailDocument;

        if (!email) {
            return res.status(404).json({ error: 'Email not found' });
        }

        const suggestion = await generateReplySuggestion(email);
        if (!suggestion) {
            return res.json({
                suggestion: null,
                message: 'No relevant training data found for this email type'
            });
        }

        res.json(suggestion);
    } catch (error) {
        console.error('Failed to generate reply suggestion:', error);
        res.status(500).json({ error: 'Failed to generate reply suggestion' });
    }
});

export default router;