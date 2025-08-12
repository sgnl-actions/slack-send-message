// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * Slack Send Message Action
 *
 * Send a message to a Slack channel using either:
 * - Webhook mode: Simple POST to webhook URL with just message text
 * - API mode: Full Slack Web API with authentication and channel specification
 */

/**
 * Send message via webhook mode
 * @param {string} text - Message text to send
 * @param {string} webhookUrl - Slack webhook URL
 * @returns {Object} Response from webhook
 */
async function sendMessageViaWebhook(text, webhookUrl) {
  const payload = { text };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
  }

  // Webhook returns plain text 'ok' on success
  const responseText = await response.text();

  return {
    ok: responseText === 'ok',
    text: responseText,
    status: response.status
  };
}

/**
 * Send message via Slack Web API
 * @param {string} text - Message text to send
 * @param {string} channel - Channel name or ID
 * @param {string} accessToken - Slack Bot OAuth token
 * @param {string} apiUrl - Base Slack API URL
 * @returns {Object} Response from Slack API
 */
async function sendMessageViaAPI(text, channel, accessToken, apiUrl) {
  const url = new URL('/api/chat.postMessage', apiUrl);

  const payload = {
    text,
    channel
  };

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Slack API request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Check if Slack returned an error in the response body
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error || 'Unknown error'}`);
  }

  return result;
}

const slackScript = {
  /**
   * Main execution handler
   * @param {Object} params - Input parameters
   * @param {string} params.text - Message text to send
   * @param {string} params.channel - Channel for API mode (ignored in webhook mode)
   * @param {boolean} params.isWebhook - Use webhook mode if true, API mode if false
   * @param {Object} context - Execution context
   * @returns {Object} Execution results
   */
  invoke: async (params, context) => {
    console.log('Starting Slack send message action');

    const { text, channel, isWebhook = false } = params;

    // Validate required inputs
    if (!text || text.trim().length === 0) {
      throw new Error('text parameter is required and cannot be empty');
    }

    if (isWebhook) {
      console.log('Using webhook mode');

      // Get webhook URL from environment
      const webhookUrl = context.environment?.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('SLACK_WEBHOOK_URL environment variable is required for webhook mode');
      }

      const result = await sendMessageViaWebhook(text, webhookUrl);

      console.log(`Message sent via webhook. Status: ${result.status}`);

      return {
        status: 'success',
        text: text,
        ok: result.ok,
        mode: 'webhook'
      };
    } else {
      console.log('Using API mode');

      // Validate channel is provided for API mode
      if (!channel || channel.trim().length === 0) {
        throw new Error('channel parameter is required for API mode');
      }

      // Get access token from secrets
      const accessToken = context.secrets?.SLACK_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('SLACK_ACCESS_TOKEN secret is required for API mode');
      }

      // Get API URL from environment (default to slack.com)
      const apiUrl = context.environment?.SLACK_API_URL || 'https://slack.com';

      const result = await sendMessageViaAPI(text, channel, accessToken, apiUrl);

      console.log(`Message sent via API to channel ${channel}. Timestamp: ${result.ts}`);

      return {
        status: 'success',
        text: text,
        channel: channel,
        ts: result.ts,
        ok: result.ok,
        mode: 'api'
      };
    }
  },

  /**
   * Error recovery handler
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, context) => {
    const { error } = params;
    console.error(`Slack send message error: ${error.message}`);

    // Check for retryable errors
    if (error.message.includes('429')) {
      console.log('Rate limited, waiting before retry');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Attempt recovery by retrying the original operation
      try {
        return await slackScript.invoke(params, context);
      } catch (retryError) {
        console.error(`Retry failed: ${retryError.message}`);
        throw new Error(`Failed after retry: ${retryError.message}`);
      }
    }

    // Check for server errors that might be transient
    if (error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')) {
      console.log('Server error detected, marking as retryable');
      return { status: 'retry_requested' };
    }

    // Fatal errors (authentication, validation, etc.)
    if (error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('invalid_auth') ||
        error.message.includes('channel_not_found') ||
        error.message.includes('is required')) {
      console.error('Fatal error, will not retry');
      throw error;
    }

    // Default: let framework handle retry
    return { status: 'retry_requested' };
  },

  /**
   * Graceful shutdown handler
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason } = params;
    console.log(`Slack send message action halted: ${reason}`);

    // No cleanup needed for Slack messaging
    return {
      status: 'halted',
      reason: reason,
      halted_at: new Date().toISOString()
    };
  }
};

module.exports = slackScript;
