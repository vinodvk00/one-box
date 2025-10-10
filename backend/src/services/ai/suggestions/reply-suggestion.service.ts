import OpenAI from 'openai';
import { searchSimilarTraining } from './vector-store.service';
import { EmailDocument } from '../../../types/email.types';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

export interface ReplySuggestion {
    suggestion: string;
    confidence: number;
    relevantContext?: string[];
}

export async function generateReplySuggestion(email: EmailDocument): Promise<ReplySuggestion | null> {
    try {
        const emailContext = `Subject: ${email.subject}\nFrom: ${email.from.address}\nBody: ${email.body}`;
        const relevantTraining = await searchSimilarTraining(emailContext, 3);

        if (relevantTraining.length === 0) {
            return null;
        }

        const trainingContext = relevantTraining.map(t =>
            `Scenario: ${t.scenario}\nContext: ${t.context}\nResponse Template: ${t.response_template}`
        ).join('\n\n');

        const prompt = `You are an email reply assistant. Based on the following training examples and the incoming email, suggest an appropriate reply.

Training Examples:
${trainingContext}

Incoming Email:
From: ${email.from.name} <${email.from.address}>
Subject: ${email.subject}
Body: ${email.body}

Generate a professional reply that follows the patterns from the training examples. If the email matches a scenario from the training data, adapt that response template appropriately.

Respond with ONLY the suggested reply text, no additional explanation.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7, // Slightly higher temperature for more natural replies
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error('No response from OpenAI API');
        }

        const suggestion = response.choices[0].message?.content?.trim();

        if (!suggestion) {
            throw new Error('Empty response from OpenAI API');
        }

        return {
            suggestion,
            confidence: 0.85, // have to calculate this based on similarity scores 
            // TODO: Implement a proper confidence score based on training data similarity
            relevantContext: relevantTraining.map(t => t.scenario)
        };

    } catch (error) {
        console.error('Error generating reply suggestion:', error);
        return null;
    }
}