import script from '../src/script.mjs';
import { jest } from '@jest/globals';

describe('Slack Send Message Script', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  describe('invoke handler - Webhook Mode', () => {
    const webhookContext = {
      environment: {
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
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
        webhookContext.environment.SLACK_WEBHOOK_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
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
        .rejects.toThrow('SLACK_WEBHOOK_URL environment variable is required for webhook mode');
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
        SLACK_API_URL: 'https://slack.com'
      },
      secrets: {
        SLACK_ACCESS_TOKEN: 'xoxb-test-token-fake'
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
            'Content-Type': 'application/json'
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

    test('should use default API URL when not specified', async () => {
      const params = {
        text: 'Hello!',
        channel: '#test'
      };

      const contextWithoutApiUrl = {
        environment: {},
        secrets: {
          SLACK_ACCESS_TOKEN: 'xoxb-test'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          ts: '123456789.123'
        })
      });

      await script.invoke(params, contextWithoutApiUrl);

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.any(Object)
      );
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
        .rejects.toThrow('SLACK_ACCESS_TOKEN secret is required for API mode');
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
      environment: { SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' },
      secrets: { SLACK_ACCESS_TOKEN: 'xoxb-test' }
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
      environment: { SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' },
      secrets: { SLACK_ACCESS_TOKEN: 'xoxb-test' }
    };

    test('should retry on rate limit (429) and recover', async () => {
      const params = {
        text: 'Hello!',
        isWebhook: true,
        error: {
          message: 'Rate limited: 429'
        }
      };

      // Mock setTimeout to avoid actual delay in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 1;
      });

      // Mock successful retry
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok')
      });

      const result = await script.error(params, mockContext);

      expect(result.status).toBe('success');
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);

      // Cleanup
      setTimeout.mockRestore();
    });

    test('should mark server errors as retryable', async () => {
      const params = {
        error: {
          message: 'Server error: 503 Service Unavailable'
        }
      };

      const result = await script.error(params, mockContext);
      expect(result.status).toBe('retry_requested');
    });

    test('should throw fatal errors', async () => {
      const params = {
        error: {
          message: 'Authentication failed: 401 Unauthorized'
        }
      };

      let thrownError;
      try {
        await script.error(params, mockContext);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('Authentication failed: 401 Unauthorized');
    });

    test('should throw validation errors as fatal', async () => {
      const params = {
        error: {
          message: 'channel_not_found: Channel does not exist'
        }
      };

      let thrownError;
      try {
        await script.error(params, mockContext);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('channel_not_found');
    });

    test('should request retry for unknown errors', async () => {
      const params = {
        error: {
          message: 'Unknown network error'
        }
      };

      const result = await script.error(params, mockContext);
      expect(result.status).toBe('retry_requested');
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