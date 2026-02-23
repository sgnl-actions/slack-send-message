import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import fetch from 'node-fetch';
if (!globalThis.fetch) globalThis.fetch = fetch;

import script from '../../src/script.mjs';

const slackToken = process.env.SLACK_BOT_TOKEN;
const slackChannel = process.env.SLACK_CHANNEL_ID;

if (!slackToken || !slackChannel) {
  console.error('SLACK_BOT_TOKEN and SLACK_CHANNEL_ID must be set in your .env file');
  process.exit(1);
}

const apiContext = {
  environment: { ADDRESS: 'https://slack.com' },
  secrets: { BEARER_AUTH_TOKEN: slackToken }
};

const params = {
  text: 'Live contract test message (plain Node.js)',
  channel: slackChannel,
  isWebhook: false
};

(async () => {
  try {
    console.log('Sending Slack message...');
    const result = await script.invoke(params, apiContext);
    console.log('Slack API response:', result);
    if (result.status === 'success' && result.ok) {
      console.log('✅ Message sent successfully!');
      process.exit(0);
    } else {
      console.error('❌ Unexpected response:', result);
      process.exit(2);
    }
  } catch (err) {
    console.error('❌ Error sending message:', err);
    process.exit(1);
  }
})();
