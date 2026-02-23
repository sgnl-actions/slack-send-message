import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import fetch from 'node-fetch';
if (!globalThis.fetch) globalThis.fetch = fetch;
import script from '../../src/script.mjs';

const slackToken = process.env.SLACK_BOT_TOKEN;

if (!slackToken) {
  console.error('SLACK_BOT_TOKEN must be set in your .env file');
  process.exit(1);
}

const apiContext = {
  environment: { ADDRESS: 'https://slack.com' },
  secrets: { BEARER_AUTH_TOKEN: slackToken }
};

const params = {
  text: 'Integration test: invalid channel',
  channel: 'C_INVALID_CHANNEL',
  isWebhook: false
};

(async () => {
  try {
    console.log('Sending to invalid channel...');
    const result = await script.invoke(params, apiContext);
    console.log('Unexpected success:', result);
    process.exit(2);
  } catch (err) {
    console.error('Expected error:', err.message);
    process.exit(0);
  }
})();
