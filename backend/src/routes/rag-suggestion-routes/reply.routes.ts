import { Router } from 'express';
import { suggestReply } from '../../controllers/rag-suggestion/reply.controller';

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
router.get('/:id/suggest-reply', suggestReply);

export default router;