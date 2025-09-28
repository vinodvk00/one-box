import { Request, Response } from 'express';
import { getEmailById, type EmailDocument } from '../../services/elasticsearch.service';
import { generateReplySuggestion } from '../../services/rag-suggestion-services/reply-suggestion.service';

/**
 * Get AI-suggested reply for an email
 */
export const suggestReply = async (req: Request, res: Response) => {
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
};