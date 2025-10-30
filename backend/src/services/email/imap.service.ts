import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createIndex, indexEmail, emailExists, getUncategorizedEmailIds, getCategoryStats } from '../../core/container';
import { EmailDocument } from '../../types/email.types';
import { categorizeEmail, EmailContent, isConfigured } from '../ai/ai-categorization.service';
import { startBatchCategorization, isBatchCategorizationRunning, getBatchCategorizationState } from '../ai/batch-categorization.service';
import { handleInterestedEmail } from '../shared/notification.service';

export interface ImapConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

const createEmailContent = (parsed: any): EmailContent => ({
    subject: parsed.subject || '',
    body: parsed.text || parsed.html || '',
    from: {
        name: parsed.from?.value[0]?.name || '',
        address: parsed.from?.value[0]?.address || ''
    }
});

const extractRecipients = (parsed: any): Array<{ name: string; address: string }> => {
    if (!parsed.to) return [];

    const recipients = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
    return recipients.flatMap((recipient: any) =>
        recipient.value.map((val: any) => ({
            name: val.name || '',
            address: val.address || ''
        }))
    );
};

const extractFlags = (msg: any): string[] =>
    Array.isArray(msg.flags) ? msg.flags : Array.from(msg.flags || []);

const createBaseEmailDocument = (msg: any, parsed: any, config: ImapConfig): Omit<EmailDocument, 'category'> => ({
    id: `${config.auth.user}_${msg.uid}`,
    account: config.auth.user,
    folder: 'INBOX',
    subject: parsed.subject || '',
    from: {
        name: parsed.from?.value[0]?.name || '',
        address: parsed.from?.value[0]?.address || ''
    },
    to: extractRecipients(parsed),
    date: parsed.date || new Date(),
    body: parsed.text || parsed.html || '',
    textBody: parsed.text,
    htmlBody: typeof parsed.html === 'string' ? parsed.html : undefined,
    flags: extractFlags(msg),
    uid: String(msg.uid)
});

const createEmailDocumentWithoutCategory = async (
    msg: any,
    parsed: any,
    config: ImapConfig
): Promise<EmailDocument> => {
    const baseDocument = createBaseEmailDocument(msg, parsed, config);
    return baseDocument as EmailDocument; // category is optional in the interface
};

const createEmailDocumentWithCategory = async (
    msg: any,
    parsed: any,
    config: ImapConfig
): Promise<EmailDocument> => {
    const baseDocument = createBaseEmailDocument(msg, parsed, config);

    try {
        const emailContent = createEmailContent(parsed);
        const categorization = await categorizeEmail(emailContent);

        const finalDocument = {
            ...baseDocument,
            category: categorization?.category
        } as EmailDocument;

        // --- CHANGE START ---
        // If the email is categorized as 'Interested', trigger notifications.
        // fireing the notification, can be async, so we handle it separately with a catch later
        // IMPROVE: Catch errors in notification handling
        if (finalDocument.category === 'Interested') {
            handleInterestedEmail(finalDocument).catch((err: any) => {
                console.error(`[IMAP Service] Failed to trigger notification for new email ${finalDocument.id}:`, err);
            });
        }

        return finalDocument;

    } catch (error) {
        console.error(`[${config.auth.user}] Categorization failed for new email:`, error);
        return baseDocument as EmailDocument;
    }
};

const createDateThreshold = (daysAgo: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
};

const logCategorizationStatus = async (account: string): Promise<void> => {
    try {
        const uncategorizedIds = await getUncategorizedEmailIds();

        console.log(`\n📊 [${account}] Email status:`);

        if (uncategorizedIds.length > 0) {
            console.log(`   🔍 Uncategorized emails: ${uncategorizedIds.length}`);
            console.log(`   ℹ️  Users can categorize their emails from the dashboard`);
        } else {
            console.log(`   ✅ All emails categorized`);
        }
        console.log('');
    } catch (error) {
        console.error(`[${account}] Failed to fetch categorization stats:`, error);
    }
};

const ensureAllEmailsCategorized = async (account: string): Promise<void> => {
    if (!isConfigured()) {
        console.warn(`⚠️  [${account}] GEMENI_API_KEY not configured - emails will remain uncategorized`);
        return;
    }

    try {
        // Get current uncategorized count
        const uncategorizedIds = await getUncategorizedEmailIds();

        if (uncategorizedIds.length === 0) {
            console.log(`✅ [${account}] All emails are categorized!`);
            return;
        }

        console.log(`ℹ️  [${account}] Found ${uncategorizedIds.length} uncategorized emails. Users can trigger categorization from the dashboard.`);


        await logCategorizationStatus(account);

    } catch (error) {
        console.error(`❌ [${account}] Error checking categorization status:`, error);
    }
};

const processHistoricalEmails = async (
    client: ImapFlow,
    config: ImapConfig,
    dateThreshold: Date
): Promise<{ indexed: number; skipped: number }> => {
    let newEmailsIndexed = 0;
    let skippedEmails = 0;

    console.log(`[${config.auth.user}] Fetching emails from the last 30 days...`);

    for await (let msg of client.fetch({ since: dateThreshold }, {
        source: true,
        envelope: true,
        flags: true
    })) {
        if (!msg.source) continue;

        const emailId = `${config.auth.user}_${msg.uid}`;

        // Check if email already exists
        const exists = await emailExists(emailId);
        if (exists) {
            skippedEmails++;
            continue;
        }

        try {
            const parsed = await simpleParser(msg.source);
            const emailDoc = await createEmailDocumentWithoutCategory(msg, parsed, config);

            await indexEmail(emailDoc);
            newEmailsIndexed++;
            console.log(`[${config.auth.user}] Indexed: ${parsed.subject} [pending categorization]`);
        } catch (error) {
            console.error(`[${config.auth.user}] Error processing email ${emailId}:`, error);
        }
    }

    return { indexed: newEmailsIndexed, skipped: skippedEmails };
};

const processNewEmail = async (
    client: ImapFlow,
    config: ImapConfig
): Promise<boolean> => {
    if (!client.mailbox || typeof client.mailbox.exists !== 'number') {
        return false;
    }

    const latestUid = client.mailbox.exists;

    try {
        const msg = await client.fetchOne(String(latestUid), {
            source: true,
            flags: true
        });

        if (!msg || !msg.source) {
            return false;
        }

        const emailId = `${config.auth.user}_${msg.uid}`;

        const exists = await emailExists(emailId);
        if (exists) {
            console.log(`[${config.auth.user}] New email already exists, skipping.`);
            return false;
        }

        const parsed = await simpleParser(msg.source);
        const emailDoc = await createEmailDocumentWithCategory(msg, parsed, config);

        await indexEmail(emailDoc);
        console.log(`[${config.auth.user}] Indexed new email: ${parsed.subject} [${emailDoc.category || 'uncategorized'}]`);

        return true;
    } catch (error) {
        console.error(`[${config.auth.user}] Error processing new email:`, error);
        return false;
    }
};

export const startSyncForAccount = async (config: ImapConfig): Promise<void> => {
    await createIndex();

    if (!isConfigured()) {
        console.warn(`⚠️  [${config.auth.user}] keys not configured. Emails will not be categorized.`);
    }

    const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
        logger: false,
    });

    const performInitialSync = async (): Promise<void> => {
        console.log(`[${config.auth.user}] Connecting to IMAP server...`);
        await client.connect();
        console.log(`[${config.auth.user}] Connection successful.`);

        // Open mailbox in read-only mode to prevent marking emails as read
        const lock = await client.getMailboxLock('INBOX', { readOnly: true });

        try {
            const thirtyDaysAgo = createDateThreshold(30);
            const { indexed, skipped } = await processHistoricalEmails(client, config, thirtyDaysAgo);

            console.log(`[${config.auth.user}] Initial fetch complete. New: ${indexed}, Skipped: ${skipped}`);

            await logCategorizationStatus(config.auth.user);

            await ensureAllEmailsCategorized(config.auth.user);

            client.on('exists', (data) => {
                console.log(`[${config.auth.user}] New email arrived. Total in INBOX: ${data.count}`);
                handleNewEmail();
            });

        } finally {
            lock.release();
        }

        console.log(`[${config.auth.user}] Now in IDLE mode, waiting for new emails...`);
    };

    const handleNewEmail = async (): Promise<void> => {
        const lock = await client.getMailboxLock('INBOX', { readOnly: true });

        try {
            await processNewEmail(client, config);
        } finally {
            lock.release();
        }
    };

    console.log(`[${config.auth.user}] Starting IMAP sync...`);

    try {
        await performInitialSync();
    } catch (error) {
        console.error(`[${config.auth.user}] IMAP sync error:`, error);
        throw error;
    }
};
