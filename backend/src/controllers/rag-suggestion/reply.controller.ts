import { Request, Response } from 'express';
import { emailRepository } from '../../core/container';
import { generateReplySuggestion } from '../../services/ai/suggestions/reply-suggestion.service';

// Type for email document (should match EmailDocument from the service)
type EmailDocument = any; // TODO: Import proper type from email.types.ts

/**
 * Get AI-suggested reply for an email
 */
export const suggestReply = async (req: Request, res: Response) => {
    try {
        const email = await emailRepository.getById(req.params.id) as EmailDocument;

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