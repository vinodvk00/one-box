import dotenv from 'dotenv';
dotenv.config();

interface IntegrationConfig {
    slackWebhookUrl: string | undefined;
    webhookSiteUrl: string | undefined;
}

export const integrationConfig: IntegrationConfig = {
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    webhookSiteUrl: process.env.WEBHOOK_SITE_URL,
};

if (!integrationConfig.slackWebhookUrl) {
    console.warn('⚠️ SLACK_WEBHOOK_URL is not configured. Slack notifications will be disabled.');
}

if (!integrationConfig.webhookSiteUrl) {
    console.warn('⚠️ WEBHOOK_SITE_URL is not configured. Webhook notifications will be disabled.');
}
