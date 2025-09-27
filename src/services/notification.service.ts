import axios from 'axios';
import { integrationConfig } from '../config/integrations';
import { EmailDocument } from './elasticsearch.service';

/**
 * Sends a rich notification to a configured Slack channel when an email is marked as 'Interested'.
 * @param email The email document that was categorized as 'Interested'.
 */
const sendSlackNotification = async (email: EmailDocument): Promise<void> => {
    const { slackWebhookUrl } = integrationConfig;

    if (!slackWebhookUrl) {
        console.warn('Slack Webhook URL not configured, skipping notification.');
        return;
    }

    try {
        // Construct a message using Slack's Block Kit for a richer 
        const slackMessage = {
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: '🚀 New Interested Lead!',
                        emoji: true,
                    },
                },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*From:*\n${email.from.name} <${email.from.address}>` },
                        { type: 'mrkdwn', text: `*Subject:*\n${email.subject}` },
                        { type: 'mrkdwn', text: `*Account:*\n${email.account}` },
                        { type: 'mrkdwn', text: `*Category:*\n${email.category}` },
                    ],
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `*Snippet:* ${email.body.substring(0, 200)}...`,
                        },
                    ],
                },
                {
                    type: 'divider',
                },
            ],
        };

        await axios.post(slackWebhookUrl, slackMessage);
        console.log(`[Notification] Successfully sent Slack notification for email ID: ${email.id}`);

    } catch (error) {
        console.error(`[Notification] Failed to send Slack notification for email ID ${email.id}:`);
        // We throw the error so Promise.allSettled can catch it and report the failure.
        throw error;
    }
};

/**
 * Sends the full email document to a generic webhook URL (e.g., webhook.site).
 * @param email The email document that was categorized as 'Interested'.
 */
const sendWebhookNotification = async (email: EmailDocument): Promise<void> => {
    const { webhookSiteUrl } = integrationConfig;

    if (!webhookSiteUrl) {
        console.warn('Webhook Site URL not configured, skipping notification.');
        return;
    }

    try {
        await axios.post(webhookSiteUrl, email);
        console.log(`[Notification] Successfully sent webhook notification for email ID: ${email.id}`);

    } catch (error) {
        console.error(`[Notification] Failed to send webhook notification for email ID ${email.id}:`, error);
        throw error;
    }
};

/**
 * Orchestrates sending all required notifications when an email is identified as 'Interested'.
 * This function calls multiple notification services concurrently.
 * @param email The email document to send notifications for.
 */
export const handleInterestedEmail = async (email: EmailDocument): Promise<void> => {
    console.log(`[Notification] Handling 'Interested' email. ID: ${email.id}. Triggering notifications...`);

    const notificationPromises = [
        sendSlackNotification(email),
        sendWebhookNotification(email),
    ];

    const results = await Promise.allSettled(notificationPromises);

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const serviceName = index === 0 ? 'Slack' : 'Webhook';
            console.error(`[Notification] The ${serviceName} notification failed:`, result.reason);
        }
    });
};
