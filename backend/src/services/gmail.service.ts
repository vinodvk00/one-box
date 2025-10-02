import { gmail_v1, google } from 'googleapis';
import { createOAuthClient, getValidAccessToken } from './oauth.service';
import { EmailDocument, indexEmail, bulkIndexEmails } from './elasticsearch.service';

interface CachedToken {
    accessToken: string;
    expiryTime: number;
}

const tokenCache = new Map<string, CachedToken>();
const TOKEN_CACHE_BUFFER_MS = 5 * 60 * 1000;

const getCachedAccessToken = async (email: string): Promise<string> => {
    const now = Date.now();
    const cached = tokenCache.get(email);

    if (cached && cached.expiryTime > now + TOKEN_CACHE_BUFFER_MS) {
        return cached.accessToken;
    }

    const accessToken = await getValidAccessToken(email);

    const expiryTime = now + 55 * 60 * 1000;

    tokenCache.set(email, {
        accessToken,
        expiryTime
    });

    return accessToken;
};

export const clearTokenCache = (email: string) => {
    tokenCache.delete(email);
};

export interface GmailEmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    payload: gmail_v1.Schema$MessagePart;
    internalDate: string;
    historyId: string;
    sizeEstimate: number;
}

const getGmailClient = async (email: string, retryCount = 0): Promise<gmail_v1.Gmail> => {
    try {
        const accessToken = await getCachedAccessToken(email);
        const oAuthClient = createOAuthClient();
        oAuthClient.setCredentials({ access_token: accessToken });

        return google.gmail({ version: 'v1', auth: oAuthClient });
    } catch (error: any) {
        console.error(`Failed to get Gmail client for ${email}:`, error);

        clearTokenCache(email);

        // If authentication failed and we haven't retried yet, try to force refresh
        if (retryCount < 1 && (error.message?.includes('No refresh token') || error.message?.includes('Failed to refresh'))) {
            console.log(`🔄 Attempting to force refresh tokens for ${email}...`);
            try {
                // Get fresh tokens and retry
                const { forceReconnectAccount } = await import('./oauth.service');
                throw new Error(`Token refresh failed for ${email}. Please reconnect your account.`);
            } catch (refreshError) {
                throw new Error(`Authentication failed for ${email}. Please reconnect your Gmail account.`);
            }
        }

        throw error;
    }
};

const extractEmailContent = (payload: gmail_v1.Schema$MessagePart): { textBody: string; htmlBody: string } => {
    let textBody = '';
    let htmlBody = '';

    if (!payload) {
        return { textBody: '', htmlBody: '' };
    }

    if (payload.body?.data) {
        try {
            const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
            if (payload.mimeType === 'text/plain') {
                textBody = decoded;
            } else if (payload.mimeType === 'text/html') {
                htmlBody = decoded;
            }
        } catch (error) {
            console.warn('Failed to decode email body:', error);
            try {
                const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                if (payload.mimeType === 'text/plain') {
                    textBody = decoded;
                } else if (payload.mimeType === 'text/html') {
                    htmlBody = decoded;
                }
            } catch (fallbackError) {
                console.warn('Failed to decode with fallback encoding:', fallbackError);
            }
        }
    }

    if (payload.parts && payload.parts.length > 0) {
        for (const part of payload.parts) {
            const content = extractEmailContent(part);
            if (content.textBody && !textBody) {
                textBody = content.textBody;
            }
            if (content.htmlBody && !htmlBody) {
                htmlBody = content.htmlBody;
            }
        }
    }

    return { textBody, htmlBody };
};

const parseEmailAddresses = (headerValue?: string): Array<{name: string, address: string}> => {
    if (!headerValue) return [];

    const addresses = headerValue.split(',').map(addr => {
        const match = addr.trim().match(/^(?:"?([^"]*)"?\s)?<?([^<>]+)>?$/);
        if (match) {
            return {
                name: match[1]?.trim() || '',
                address: match[2]?.trim() || ''
            };
        }
        return { name: '', address: addr.trim() };
    });

    return addresses;
};

const getHeaderValue = (headers: gmail_v1.Schema$MessagePartHeader[] = [], name: string): string => {
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || '';
};

const convertGmailMessageToEmailDocument = (message: GmailEmailMessage, account: string, format: 'full' | 'metadata' = 'full'): EmailDocument => {
    const headers = message.payload?.headers || [];

    const fromHeader = getHeaderValue(headers, 'from');
    const toHeader = getHeaderValue(headers, 'to');
    const subject = getHeaderValue(headers, 'subject');
    const dateHeader = getHeaderValue(headers, 'date');

    const fromAddresses = parseEmailAddresses(fromHeader);
    const toAddresses = parseEmailAddresses(toHeader);

    const date = dateHeader ? new Date(dateHeader) : new Date(parseInt(message.internalDate));

    let textBody = '';
    let htmlBody = '';

    if (format === 'full' && message.payload) {
        const extracted = extractEmailContent(message.payload);
        textBody = extracted.textBody;
        htmlBody = extracted.htmlBody;
    }

    const body = textBody || htmlBody || message.snippet || '';

    return {
        id: `${account}_${message.id}`,
        account,
        folder: 'INBOX',
        subject: subject || '(No Subject)',
        from: fromAddresses[0] || { name: '', address: '' },
        to: toAddresses,
        date,
        body,
        textBody,
        htmlBody,
        flags: [],
        uid: message.id
    };
};

export const fetchGmailMessages = async (
    email: string,
    daysBack: number = 30,
    maxResults: number = 100,
    forceReindex: boolean = false
): Promise<EmailDocument[]> => {
    const startTime = Date.now();
    try {
        const gmail = await getGmailClient(email);

        console.log(`📧 Fetching Gmail messages for ${email} from last ${daysBack} days...`);

        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: maxResults * 2 
        });

        const messageIds = listResponse.data.messages || [];
        console.log(`📧 Found ${messageIds.length} total messages for ${email}`);

        if (messageIds.length === 0) {
            return [];
        }

        const emails: EmailDocument[] = [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        let processedCount = 0;
        let skippedCount = 0;
        const FETCH_CONCURRENCY = 10; 
        const INDEX_BATCH_SIZE = 50; 
        let currentBatch: EmailDocument[] = [];

        console.log(`📊 Will check up to ${messageIds.length} messages, looking for ${maxResults} emails from last ${daysBack} days`);

        for (let i = 0; i < messageIds.length; i += FETCH_CONCURRENCY) {
            if (processedCount >= maxResults) {
                console.log(`✅ Reached maxResults limit of ${maxResults}`);
                break;
            }
            if (skippedCount >= 100) {
                console.log(`⏹️ Stopped after skipping ${skippedCount} old emails`);
                break;
            }

            const batch = messageIds.slice(i, i + FETCH_CONCURRENCY);

            const fetchPromises = batch.map(async (messageRef) => {
                try {
                    let messageFormat: 'full' | 'metadata' = 'full';
                    let messageResponse;

                    try {
                        messageResponse = await gmail.users.messages.get({
                            userId: 'me',
                            id: messageRef.id!,
                            format: 'full'
                        });
                    } catch (scopeError: any) {
                        if (scopeError.message?.includes('Metadata scope') || scopeError.status === 403) {
                            messageFormat = 'metadata';
                            messageResponse = await gmail.users.messages.get({
                                userId: 'me',
                                id: messageRef.id!,
                                format: 'metadata'
                            });
                        } else {
                            throw scopeError;
                        }
                    }

                    const message = messageResponse.data as GmailEmailMessage;
                    return { message, messageFormat, messageRef };
                } catch (error) {
                    console.error(`Failed to fetch message ${messageRef.id}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(fetchPromises);

            for (const result of results) {
                if (!result) continue;
                if (processedCount >= maxResults) break;

                const { message, messageFormat, messageRef } = result;

                const messageDate = new Date(parseInt(message.internalDate));
                if (messageDate < cutoffDate) {
                    skippedCount++;
                    if (skippedCount >= 30) {
                        console.log(`📧 Reached messages older than ${daysBack} days, stopping...`);
                        break;
                    }
                    continue;
                }

                const emailDoc = convertGmailMessageToEmailDocument(message, email, messageFormat);

                if (processedCount < 3) {
                    console.log(`📧 Email ${messageRef.id} content:`, {
                        subject: emailDoc.subject,
                        hasTextBody: !!emailDoc.textBody,
                        hasHtmlBody: !!emailDoc.htmlBody,
                        bodyLength: emailDoc.body?.length || 0,
                        mimeType: message.payload?.mimeType,
                        hasPayloadParts: !!(message.payload?.parts?.length)
                    });
                }

                emails.push(emailDoc);
                currentBatch.push(emailDoc);
                processedCount++;

                if (currentBatch.length >= INDEX_BATCH_SIZE) {
                    await bulkIndexEmails(currentBatch);
                    currentBatch = [];
                }
            }

            if (skippedCount >= 30) {
                break;
            }
        }

        if (currentBatch.length > 0) {
            await bulkIndexEmails(currentBatch);
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const avgTimePerEmail = emails.length > 0 ? ((endTime - startTime) / emails.length / 1000).toFixed(2) : '0';

        if (emails.length === 0) {
            console.log(`ℹ️  No emails found within last ${daysBack} days for ${email}. Total checked: ${processedCount + skippedCount}, Skipped (too old): ${skippedCount}`);
        } else {
            console.log(`✅ Successfully fetched and ${forceReindex ? 're-' : ''}indexed ${emails.length} emails for ${email} from last ${daysBack} days`);
            console.log(`⏱️  Total time: ${duration}s | Avg per email: ${avgTimePerEmail}s | Processed: ${processedCount} | Skipped: ${skippedCount}`);
        }

        return emails;

    } catch (error: any) {
        console.error(`Failed to fetch Gmail messages for ${email}:`, error);

        if (error.status === 401 || error.code === 401) {
            console.log(`🔑 Authentication failed for ${email}, tokens may be invalid`);
            throw new Error(`Gmail sync failed for ${email}: Authentication failed. Please reconnect your Gmail account.`);
        }

        if (error.status === 403 || error.code === 403) {
            if (error.message?.includes('scope') || error.message?.includes('permission')) {
                throw new Error(`Gmail sync failed for ${email}: Insufficient permissions. Please reconnect your Gmail account with full access permissions.`);
            }
            throw new Error(`Gmail sync failed for ${email}: Access denied. Please check your account permissions.`);
        }

        if (error.status === 429 || error.code === 429) {
            throw new Error(`Gmail sync failed for ${email}: Rate limit exceeded. Please try again later.`);
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            throw new Error(`Gmail sync failed for ${email}: Network error. Please check your connection.`);
        }

        throw new Error(`Gmail sync failed for ${email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

export const syncAllOAuthAccounts = async (daysBack: number = 30): Promise<void> => {
    const { getActiveAccountConfigs } = await import('./oauth-storage.service');
    const syncStartTime = Date.now();

    try {
        const accounts = await getActiveAccountConfigs();
        const oauthAccounts = accounts.filter(account => account.authType === 'oauth');

        console.log(`🔄 Starting Gmail sync for ${oauthAccounts.length} OAuth accounts...`);

        for (const account of oauthAccounts) {
            try {
                await fetchGmailMessages(account.email, daysBack);
                console.log(`✅ Gmail sync completed for ${account.email}`);
            } catch (error) {
                console.error(`❌ Gmail sync failed for ${account.email}:`, error);
            }
        }

        const totalDuration = ((Date.now() - syncStartTime) / 1000).toFixed(2);
        console.log(`🎉 Gmail sync completed for all OAuth accounts in ${totalDuration}s`);

    } catch (error) {
        console.error('Failed to sync OAuth accounts:', error);
        throw error;
    }
};