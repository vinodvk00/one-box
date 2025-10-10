import { getUncategorizedEmailIds, getEmailsByIds, updateEmailCategory, bulkUpdateEmailCategories } from '../../core/container';
import { EmailDocument } from '../../types/email.types';
import { categorizeEmailBatch, BatchEmailInput, BatchCategorizationResult } from './ai-categorization.service';
import { handleInterestedEmail } from '../shared/notification.service';

interface BatchCategorizationState {
    totalProcessed: number;
    successful: number;
    failed: number;
    errors: Array<{ emailId: string; error: string }>;
}

interface ProcessingState {
    isProcessing: boolean;
    shouldStop: boolean;
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 0; // Artificial delay between batches to respect rate limits

// Global state (necessary for managing async operations)
let state: ProcessingState = {
    isProcessing: false,
    shouldStop: false
};


const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

const createBatchEmailInput = (email: EmailDocument): BatchEmailInput => ({
    id: email.id,
    email: {
        subject: email.subject,
        body: email.body,
        from: email.from
    }
});

const createInitialBatchState = (): BatchCategorizationState => ({
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    errors: []
});

const mergeBatchStates = (
    current: BatchCategorizationState,
    batch: BatchCategorizationState
): BatchCategorizationState => ({
    totalProcessed: current.totalProcessed + batch.totalProcessed,
    successful: current.successful + batch.successful,
    failed: current.failed + batch.failed,
    errors: [...current.errors, ...batch.errors]
});

const logBatchProgress = (batchNumber: number, totalBatches: number, batchSize: number, result: BatchCategorizationState): void => {
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchSize} emails)...`);
    console.log(`Batch ${batchNumber} complete: ${result.successful}/${result.totalProcessed} successful`);
};

const logDelay = (delayMs: number): void => {
    console.log(`Waiting ${delayMs / 1000} seconds before next batch...`);
};

const processCategorizationResult = async (
    batchResult: BatchCategorizationResult,
    email: EmailDocument 
): Promise<{ success: boolean; error?: string }> => {
    try {
        if (batchResult.result) {
            await updateEmailCategory(batchResult.id, batchResult.result.category);

            // If the email is categorized as 'Interested', trigger notifications
            if (batchResult.result.category === 'Interested') {
                // need to update the email object with the new category before sending
                const updatedEmail = { ...email, category: batchResult.result.category };
                handleInterestedEmail(updatedEmail).catch(err => {
                    console.error(`[Batch Service] Failed to trigger notification for email ${email.id}:`, err);
                });
            }
            return { success: true };
        } else {
            return {
                success: false,
                error: batchResult.error || 'Categorization returned null'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown update error'
        };
    }
};

const processBatch = async (emailIds: string[]): Promise<BatchCategorizationState> => {
    const result = createInitialBatchState();

    try {
        const emails = await getEmailsByIds(emailIds);
        const batchEmails = emails.map(createBatchEmailInput);

        const categorizationResults = await categorizeEmailBatch(batchEmails);

        // Prepare bulk updates and notifications
        const categoryUpdates: Array<{ id: string; category: string }> = [];
        const notificationEmails: EmailDocument[] = [];

        categorizationResults.forEach((categResult, index) => {
            result.totalProcessed++;

            if (categResult.result) {
                categoryUpdates.push({
                    id: categResult.id,
                    category: categResult.result.category
                });

                if (categResult.result.category === 'Interested') {
                    notificationEmails.push({
                        ...emails[index],
                        category: categResult.result.category
                    });
                }

                result.successful++;
                console.log(`✓ Categorized: ${emails[index].subject} → ${categResult.result.category} (${categResult.result.confidence})`);
            } else {
                result.failed++;
                result.errors.push({
                    emailId: emailIds[index],
                    error: categResult.error || 'Unknown error'
                });
                console.log(`✗ Failed to categorize: ${emails[index].subject}`);
            }
        });

        if (categoryUpdates.length > 0) {
            await bulkUpdateEmailCategories(categoryUpdates);
        }

        // Trigger notifications asynchronously
        notificationEmails.forEach(email => {
            handleInterestedEmail(email).catch(err => {
                console.error(`Failed to trigger notification for email ${email.id}:`, err);
            });
        });

    } catch (error) {
        console.error('Batch processing error:', error);
        // Mark all as failed if batch processing fails
        emailIds.forEach(emailId => {
            result.totalProcessed++;
            result.failed++;
            result.errors.push({
                emailId,
                error: error instanceof Error ? error.message : 'Batch processing failed'
            });
        });
    }

    return result;
};

const createBatches = <T>(array: T[], batchSize: number): T[][] => {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
        batches.push(array.slice(i, i + batchSize));
    }
    return batches;
};

export const startBatchCategorization = async (): Promise<BatchCategorizationState> => {
    if (state.isProcessing) {
        console.log('Batch categorization already in progress.');
        return createInitialBatchState();
    }

    state.isProcessing = true;
    state.shouldStop = false;

    console.log('Starting batch categorization of uncategorized emails...');

    let result = createInitialBatchState();

    try {
        // Get all uncategorized email IDs
        const uncategorizedIds = await getUncategorizedEmailIds();
        console.log(`Found ${uncategorizedIds.length} uncategorized emails.`);

        if (uncategorizedIds.length === 0) {
            console.log('No uncategorized emails found.');
            return result;
        }

        const batches = createBatches(uncategorizedIds, BATCH_SIZE);
        const totalBatches = batches.length;

        // Process batches sequentially with rate limiting
        for (let i = 0; i < batches.length; i++) {
            if (state.shouldStop) {
                console.log('Batch categorization stopped by request.');
                break;
            }

            const batch = batches[i];
            const batchNumber = i + 1;

            const batchResult = await processBatch(batch);

            result = mergeBatchStates(result, batchResult);

            // Log progress
            logBatchProgress(batchNumber, totalBatches, batch.length, batchResult);

            // Rate limiting: wait before next batch (except for last batch)
            if (i < batches.length - 1 && !state.shouldStop) {
                logDelay(BATCH_DELAY_MS);
                await delay(BATCH_DELAY_MS);
            }
        }

        console.log(`Batch categorization complete: ${result.successful}/${result.totalProcessed} emails categorized successfully.`);

    } catch (error) {
        console.error('Batch categorization failed:', error);
    } finally {
        state.isProcessing = false;
    }

    return result;
};

export const stopBatchCategorization = (): void => {
    if (state.isProcessing) {
        console.log('Stopping batch categorization...');
        state.shouldStop = true;
    }
};

export const isBatchCategorizationRunning = (): boolean => state.isProcessing;

export const getBatchCategorizationState = (): ProcessingState => ({ ...state });
