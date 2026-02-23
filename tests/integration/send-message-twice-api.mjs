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
  text: 'Integration test: send twice',
  channel: slackChannel,
  isWebhook: false
};

(async () => {
  try {
    console.log('First send...');
    const result1 = await script.invoke(params, apiContext);
    console.log('First response:', result1);
    console.log('Second send (should be idempotent)...');
    const result2 = await script.invoke(params, apiContext);
    console.log('Second response:', result2);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
