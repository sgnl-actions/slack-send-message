import script from '../src/script.mjs';
import { jest } from '@jest/globals';
import { SGNL_USER_AGENT } from '@sgnl-actions/utils';

describe('Slack Send Message Script', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  describe('invoke handler - Webhook Mode', () => {
    const webhookContext = {
      environment: {
        ADDRESS: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
      },
      secrets: {},
      outputs: {}
    };

    test('should send message via webhook successfully', async () => {
      const params = {
        text: 'Hello from webhook!',
        isWebhook: true
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok')
      });

      const result = await script.invoke(params, webhookContext);

      expect(fetch).toHaveBeenCalledWith(
        webhookContext.environment.ADDRESS,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': SGNL_USER_AGENT
          },
          body: JSON.stringify({ text: 'Hello from webhook!' })
        }
      );

      expect(result.status).toBe('success');
      expect(result.text).toBe('Hello from webhook!');
      expect(result.ok).toBe(true);
      expect(result.mode).toBe('webhook');
    });

    test('should throw error if webhook URL is missing', async () => {
      const params = {
        text: 'Hello!',
        isWebhook: true
      };

      const contextWithoutWebhookUrl = {
        environment: {},
        secrets: {},
        outputs: {}
      };

      await expect(script.invoke(params, contextWithoutWebhookUrl))
        .rejects.toThrow('No URL specified. Provide address parameter or ADDRESS environment variable');
    });

    test('should throw error if webhook request fails', async () => {
      const params = {
        text: 'Hello!',
        isWebhook: true
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(script.invoke(params, webhookContext))
        .rejects.toThrow('Webhook request failed: 404 Not Found');
    });
  });

  describe('invoke handler - API Mode', () => {
    const apiContext = {
      environment: {
        ADDRESS: 'https://slack.com'
      },
      secrets: {
        BEARER_AUTH_TOKEN: 'xoxb-test-token-fake'
      },
      outputs: {}
    };

    test('should send message via API successfully', async () => {
      const params = {
        text: 'Hello from API!',
        channel: '#general',
        isWebhook: false
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          channel: 'C1234567890',
          ts: '1234567890.123456'
        })
      });

      const result = await script.invoke(params, apiContext);

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer xoxb-test-token-fake',
            'Content-Type': 'application/json',
            'User-Agent': SGNL_USER_AGENT
          },
          body: JSON.stringify({
            text: 'Hello from API!',
            channel: '#general'
          })
        }
      );

      expect(result.status).toBe('success');
      expect(result.text).toBe('Hello from API!');
      expect(result.channel).toBe('#general');
      expect(result.ts).toBe('1234567890.123456');
      expect(result.ok).toBe(true);
      expect(result.mode).toBe('api');
    });


    test('should throw error if channel is missing in API mode', async () => {
      const params = {
        text: 'Hello!',
        isWebhook: false
      };

      await expect(script.invoke(params, apiContext))
        .rejects.toThrow('channel parameter is required for API mode');
    });

    test('should throw error if access token is missing', async () => {
      const params = {
        text: 'Hello!',
        channel: '#test'
      };

      const contextWithoutToken = {
        environment: {},
        secrets: {},
        outputs: {}
      };

      await expect(script.invoke(params, contextWithoutToken))
        .rejects.toThrow('No authentication configured');
    });

    test('should throw error if API request fails', async () => {
      const params = {
        text: 'Hello!',
        channel: '#test'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(script.invoke(params, apiContext))
        .rejects.toThrow('Slack API request failed: 401 Unauthorized');
    });

    test('should throw error if Slack API returns error', async () => {
      const params = {
        text: 'Hello!',
        channel: '#invalid'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: 'channel_not_found'
        })
      });

      await expect(script.invoke(params, apiContext))
        .rejects.toThrow('Slack API error: channel_not_found');
    });
  });

  describe('input validation', () => {
    const mockContext = {
      environment: { ADDRESS: 'https://slack.com' },
      secrets: { BEARER_AUTH_TOKEN: 'xoxb-test' }
    };

    test('should throw error if text is missing', async () => {
      const params = {
        channel: '#test'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('text parameter is required and cannot be empty');
    });

    test('should throw error if text is empty', async () => {
      const params = {
        text: '',
        channel: '#test'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('text parameter is required and cannot be empty');
    });

    test('should throw error if text is only whitespace', async () => {
      const params = {
        text: '   ',
        channel: '#test'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('text parameter is required and cannot be empty');
    });

    test('should throw error if channel is empty in API mode', async () => {
      const params = {
        text: 'Hello!',
        channel: '',
        isWebhook: false
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('channel parameter is required for API mode');
    });
  });

  describe('error handler', () => {
    const mockContext = {
      environment: { ADDRESS: 'https://slack.com' },
      secrets: { BEARER_AUTH_TOKEN: 'xoxb-test' }
    };

    test('should re-throw error for framework to handle', async () => {
      const error = new Error('Network timeout');
      error.statusCode = 500;

      const params = {
        text: 'Hello!',
        error: error
      };

      await expect(script.error(params, mockContext)).rejects.toThrow('Network timeout');
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        reason: 'timeout'
      };

      const result = await script.halt(params, {});

      expect(result.status).toBe('halted');
      expect(result.reason).toBe('timeout');
      expect(result.halted_at).toBeDefined();
    });
  });
});