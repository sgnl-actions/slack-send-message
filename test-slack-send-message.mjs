// test-slack-send-message.mjs
// Test script for Slack send message action (API mode, idempotency)

let slackScript;

// Dynamically import CommonJS module for compatibility
const slackScriptModule = await import('./dist/index.js');
slackScript = slackScriptModule.default || slackScriptModule;

// Set these values for your Slack workspace and channel
const env = {
  ADDRESS: 'https://slack.com', // Slack API base URL
};
const secrets = {
  BEARER_AUTH_TOKEN: process.env.SLACK_BOT_TOKEN, // Set this in your environment
};

const params = {
  text: 'Test idempotency message from SGNL action',
  channel: process.env.SLACK_CHANNEL_ID, // Set this in your environment
  isWebhook: false,
};

const context = {
  environment: env,
  secrets: secrets,
};

async function runTest() {
  try {
    console.log('First run:');
    const result1 = await slackScript.invoke(params, context);
    console.log(result1);

    console.log('\nSecond run (should be idempotent):');
    const result2 = await slackScript.invoke(params, context);
    console.log(result2);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

runTest();
