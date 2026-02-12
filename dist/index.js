// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * SGNL Actions - Authentication Utilities
 *
 * Shared authentication utilities for SGNL actions.
 * Supports: Bearer Token, Basic Auth, OAuth2 Client Credentials, OAuth2 Authorization Code
 */

/**
 * User-Agent header value for all SGNL CAEP Hub requests.
 */
const SGNL_USER_AGENT = 'SGNL-CAEP-Hub/2.0';

/**
 * Get OAuth2 access token using client credentials flow
 * @param {Object} config - OAuth2 configuration
 * @param {string} config.tokenUrl - Token endpoint URL
 * @param {string} config.clientId - Client ID
 * @param {string} config.clientSecret - Client secret
 * @param {string} [config.scope] - OAuth2 scope
 * @param {string} [config.audience] - OAuth2 audience
 * @param {string} [config.authStyle] - Auth style: 'InParams' or 'InHeader' (default)
 * @returns {Promise<string>} Access token
 */
async function getClientCredentialsToken(config) {
  const { tokenUrl, clientId, clientSecret, scope, audience, authStyle } = config;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('OAuth2 Client Credentials flow requires tokenUrl, clientId, and clientSecret');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  if (scope) {
    params.append('scope', scope);
  }

  if (audience) {
    params.append('audience', audience);
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': SGNL_USER_AGENT
  };

  if (authStyle === 'InParams') {
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
  } else {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString()
  });

  if (!response.ok) {
    let errorText;
    try {
      const errorData = await response.json();
      errorText = JSON.stringify(errorData);
    } catch {
      errorText = await response.text();
    }
    throw new Error(
      `OAuth2 token request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access_token in OAuth2 response');
  }

  return data.access_token;
}

/**
 * Get the Authorization header value from context using available auth method.
 * Supports: Bearer Token, Basic Auth, OAuth2 Authorization Code, OAuth2 Client Credentials
 *
 * @param {Object} context - Execution context with environment and secrets
 * @param {Object} context.environment - Environment variables
 * @param {Object} context.secrets - Secret values
 * @returns {Promise<string>} Authorization header value (e.g., "Bearer xxx" or "Basic xxx")
 */
async function getAuthorizationHeader(context) {
  const env = context.environment || {};
  const secrets = context.secrets || {};

  // Method 1: Simple Bearer Token
  if (secrets.BEARER_AUTH_TOKEN) {
    const token = secrets.BEARER_AUTH_TOKEN;
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Method 2: Basic Auth (username + password)
  if (secrets.BASIC_PASSWORD && secrets.BASIC_USERNAME) {
    const credentials = btoa(`${secrets.BASIC_USERNAME}:${secrets.BASIC_PASSWORD}`);
    return `Basic ${credentials}`;
  }

  // Method 3: OAuth2 Authorization Code - use pre-existing access token
  if (secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN) {
    const token = secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN;
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Method 4: OAuth2 Client Credentials - fetch new token
  if (secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET) {
    const tokenUrl = env.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL;
    const clientId = env.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID;
    const clientSecret = secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET;

    if (!tokenUrl || !clientId) {
      throw new Error('OAuth2 Client Credentials flow requires TOKEN_URL and CLIENT_ID in env');
    }

    const token = await getClientCredentialsToken({
      tokenUrl,
      clientId,
      clientSecret,
      scope: env.OAUTH2_CLIENT_CREDENTIALS_SCOPE,
      audience: env.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE,
      authStyle: env.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
    });

    return `Bearer ${token}`;
  }

  throw new Error(
    'No authentication configured. Provide one of: ' +
    'BEARER_AUTH_TOKEN, BASIC_USERNAME/BASIC_PASSWORD, ' +
    'OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN, or OAUTH2_CLIENT_CREDENTIALS_*'
  );
}

/**
 * Get the base URL/address for API calls
 * @param {Object} params - Request parameters
 * @param {string} [params.address] - Address from params
 * @param {Object} context - Execution context
 * @returns {string} Base URL
 */
function getBaseURL(params, context) {
  const env = context.environment || {};
  const address = params?.address || env.ADDRESS;

  if (!address) {
    throw new Error('No URL specified. Provide address parameter or ADDRESS environment variable');
  }

  // Remove trailing slash if present
  return address.endsWith('/') ? address.slice(0, -1) : address;
}

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

const slackScript = {
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

module.exports = slackScript;
