/**
 * Slack Send Message Action
 *
 * Send a message to a Slack channel using either:
 * - Webhook mode: Simple POST to webhook URL with just message text
 * - API mode: Full Slack Web API with authentication and channel specification
 */

import { getBaseURL, getAuthorizationHeader, SGNL_USER_AGENT } from '@sgnl-actions/utils';

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
      'Content-Type': 'application/json',
      'User-Agent': SGNL_USER_AGENT
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
 * @param {string} authHeader - Authorization header value
 * @param {string} apiUrl - Base Slack API URL
 * @returns {Object} Response from Slack API
 */
async function sendMessageViaAPI(text, channel, authHeader, apiUrl) {
  const url = `${apiUrl}/api/chat.postMessage`;

  const payload = {
    text,
    channel
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'User-Agent': SGNL_USER_AGENT
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

export default {
  /**
   * Main execution handler
   * @param {Object} params - Input parameters
   * @param {string} params.text - Message text to send (required)
   * @param {string} params.channel - Channel for API mode (optional for webhook mode, required for API mode)
   * @param {boolean} params.isWebhook - Use webhook mode if true, API mode if false (optional)
   * @param {string} params.address - Optional Slack API base URL
   * @param {Object} context - Execution context with secrets and environment
   * @param {string} context.environment.ADDRESS - Default Slack API base URL
   *
   * The configured auth type will determine which of the following environment variables and secrets are available
   * @param {string} context.secrets.BEARER_AUTH_TOKEN
   *
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN
   *
   * @returns {Promise<Object>} Action result
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

      // Get webhook URL (full URL for webhook mode)
      const webhookUrl = getBaseURL(params, context);

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

      const authHeader = await getAuthorizationHeader(context);
      const apiUrl = getBaseURL(params, context);

      const result = await sendMessageViaAPI(text, channel, authHeader, apiUrl);

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

  error: async (params, _context) => {
    const { error } = params;
    throw error;
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