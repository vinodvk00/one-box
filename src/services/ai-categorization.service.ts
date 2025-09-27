import dotenv from 'dotenv';
import OpenAI from 'openai';
dotenv.config();

export type EmailCategory = 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';

export interface EmailCategorizationResult {
    category: EmailCategory;
    confidence: number;
    reasoning?: string;
}

export interface EmailContent {
    subject: string;
    body: string;
    from: {
        name: string;
        address: string;
    };
}

export interface BatchEmailInput {
    id: string;
    email: EmailContent;
}

export interface BatchCategorizationResult {
    id: string;
    result: EmailCategorizationResult | null;
    error?: string;
}

interface BatchResponse {
    results: Array<{
        id: string;
        category: EmailCategory;
        confidence: number;
        reasoning?: string;
    }>;
}

const apiKey = process.env.OPENAI_API_KEY || '';
const openai = new OpenAI({
    apiKey: apiKey,
});

const validCategories: EmailCategory[] = [
    'Interested',
    'Meeting Booked',
    'Not Interested',
    'Spam',
    'Out of Office'
];

/*

for now handling batch and single categorization seperately 
later it will be merged after testing the batch categorization

*/
const createSinglePrompt = (email: EmailContent): string => `You are an AI email classifier. Analyze the following email and categorize it into exactly one of these categories:

1. "Interested" - Email shows genuine interest in products/services/opportunities
2. "Meeting Booked" - Email is about scheduling, confirming, or discussing meetings/calls
3. "Not Interested" - Email shows rejection, decline, or lack of interest
4. "Spam" - Promotional, marketing, or irrelevant emails
5. "Out of Office" - Auto-reply messages indicating person is unavailable

Email Details:
From: ${email.from.name} <${email.from.address}>
Subject: ${email.subject}
Body: ${email.body}

Respond with ONLY a JSON object in this exact format:
{
  "category": "one of the 5 categories above",
  "confidence": 0.85,
  "reasoning": "brief explanation"
}`;

const escapeJsonString = (str: string): string =>
    str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

const createBatchEmailObject = (batchEmail: BatchEmailInput): string => `{
    "id": "${batchEmail.id}",
    "subject": "${escapeJsonString(batchEmail.email.subject)}",
    "from_name": "${escapeJsonString(batchEmail.email.from.name)}",
    "from_address": "${escapeJsonString(batchEmail.email.from.address)}",
    "body": "${escapeJsonString(batchEmail.email.body.substring(0, 1000))}"
}`;

const createBatchPrompt = (batchEmails: BatchEmailInput[]): string => {
    const emailObjects = batchEmails.map(createBatchEmailObject).join(',\n  ');

    return `You are an AI email classifier. For each email object in the following JSON array, categorize it into exactly one of these categories:

1. "Interested" - Email shows genuine interest in products/services/opportunities
2. "Meeting Booked" - Email is about scheduling, confirming, or discussing meetings/calls
3. "Not Interested" - Email shows rejection, decline, or lack of interest
4. "Spam" - Promotional, marketing, or irrelevant emails
5. "Out of Office" - Auto-reply messages indicating person is unavailable

Emails:
[
  ${emailObjects}
]

Respond with ONLY a JSON object in this exact format, with an entry for each email:
{
  "results": [
    {
      "id": "email_id_1",
      "category": "one of the 5 categories",
      "confidence": 0.9,
      "reasoning": "brief explanation"
    },
    {
      "id": "email_id_2",
      "category": "another category",
      "confidence": 0.8,
      "reasoning": "brief explanation"
    }
  ]
}`;
};

const callOpenAIApi = async (prompt: string): Promise<string> => {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.1, // Low temperature for consistent categorization
            response_format: { type: 'json_object' }
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error('No response from OpenAI API');
        }

        const content = response.choices[0].message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI API');
        }

        return content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error(`OpenAI API error: ${error}`);
    }
};

const cleanJsonResponse = (response: string): string =>
    response.replace(/```json\n?|\n?```/g, '').trim();

const normalizeConfidence = (confidence: number): number =>
    Math.max(0, Math.min(1, confidence));

const isValidCategory = (category: string): category is EmailCategory =>
    validCategories.includes(category as EmailCategory);

const parseSingleResult = (parsed: any): EmailCategorizationResult => {
    if (!parsed.category || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response structure');
    }

    if (!isValidCategory(parsed.category)) {
        throw new Error(`Invalid category: ${parsed.category}`);
    }

    return {
        category: parsed.category,
        confidence: normalizeConfidence(parsed.confidence),
        reasoning: parsed.reasoning || undefined
    };
};

const parseBatchResult = (parsed: BatchResponse, requestIds: string[]): BatchCategorizationResult[] => {
    if (!parsed.results || !Array.isArray(parsed.results)) {
        throw new Error('Invalid batch response structure');
    }

    const resultMap = new Map(
        parsed.results.map(result => [result.id, result])
    );

    return requestIds.map(id => {
        const apiResult = resultMap.get(id);

        if (!apiResult) {
            return {
                id,
                result: null,
                error: 'No result returned for this email'
            };
        }

        try {
            if (!isValidCategory(apiResult.category)) {
                throw new Error(`Invalid category: ${apiResult.category}`);
            }

            return {
                id,
                result: {
                    category: apiResult.category,
                    confidence: normalizeConfidence(apiResult.confidence),
                    reasoning: apiResult.reasoning
                }
            };
        } catch (error) {
            return {
                id,
                result: null,
                error: error instanceof Error ? error.message : 'Unknown parsing error'
            };
        }
    });
};

const parseCategorizationResponse = (response: string): EmailCategorizationResult => {
    try {
        const cleanedResponse = cleanJsonResponse(response);
        const parsed = JSON.parse(cleanedResponse);
        return parseSingleResult(parsed);
    } catch (error) {
        console.error('Failed to parse categorization response:', error);
        console.error('Raw response:', response);
        throw new Error('Failed to parse AI categorization response');
    }
};

const parseBatchCategorizationResponse = (response: string, requestIds: string[]): BatchCategorizationResult[] => {
    try {
        const cleanedResponse = cleanJsonResponse(response);
        const parsed = JSON.parse(cleanedResponse) as BatchResponse;
        return parseBatchResult(parsed, requestIds);
    } catch (error) {
        console.error('Failed to parse batch categorization response:', error);
        console.error('Raw response:', response);
        // Return error results for all emails
        return requestIds.map(id => ({
            id,
            result: null,
            error: 'Failed to parse batch response'
        }));
    }
};


export const categorizeEmail = async (email: EmailContent): Promise<EmailCategorizationResult | null> => {
    try {
        if (!apiKey) {
            console.warn('OpenAI API key not configured, skipping categorization');
            return null;
        }

        const prompt = createSinglePrompt(email);
        const response = await callOpenAIApi(prompt);
        const result = parseCategorizationResponse(response);

        console.log(`Email categorized as: ${result.category} (confidence: ${result.confidence})`);
        return result;

    } catch (error) {
        console.error('Email categorization failed:', error);
        return null;
    }
};

export const categorizeEmailBatch = async (batchEmails: BatchEmailInput[]): Promise<BatchCategorizationResult[]> => {
    try {
        if (!apiKey) {
            console.warn('OpenAI API key not configured, skipping batch categorization');
            return batchEmails.map(({ id }) => ({
                id,
                result: null,
                error: 'API key not configured'
            }));
        }

        if (batchEmails.length === 0) {
            return [];
        }

        const prompt = createBatchPrompt(batchEmails);
        const response = await callOpenAIApi(prompt);
        const requestIds = batchEmails.map(({ id }) => id);
        const results = parseBatchCategorizationResponse(response, requestIds);

        console.log(`Batch categorization complete: ${results.filter(r => r.result).length}/${results.length} successful`);
        return results;

    } catch (error) {
        console.error('Batch categorization failed:', error);
        return batchEmails.map(({ id }) => ({
            id,
            result: null,
            error: error instanceof Error ? error.message : 'Unknown batch error'
        }));
    }
};

export const categorizeEmailBatchLegacy = async (emails: EmailContent[]): Promise<(EmailCategorizationResult | null)[]> => {
    const batchEmails: BatchEmailInput[] = emails.map((email, index) => ({
        id: index.toString(),
        email
    }));

    const batchResults = await categorizeEmailBatch(batchEmails);
    return batchResults.map(({ result }) => result);
};

export const isConfigured = (): boolean => !!apiKey;