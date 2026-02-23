import { beforeAll, afterAll, afterEach, describe, test, expect, jest } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { request } from 'https';
import script from '../src/script.mjs';

const FIXTURES_DIR = '__recordings__';
const FIXTURE_FILE = `${FIXTURES_DIR}/slack-api.json`;
const IS_RECORDING = process.env.RECORD_MODE === 'record';

function loadFixtures() {
  if (existsSync(FIXTURE_FILE)) {
    return JSON.parse(readFileSync(FIXTURE_FILE, 'utf-8'));
  }
  return {};
}

function saveFixtures(fixtures) {
  if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(FIXTURE_FILE, JSON.stringify(fixtures, null, 2));
}

// In record mode: call real fetch, capture + return response
// In replay mode: return saved fixture
// Use built-in https to make real HTTP calls during recording (no extra deps)
function httpsPost(url, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body;
    const req = request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'POST',
      headers: { ...options.headers, 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isJson = res.headers['content-type']?.includes('application/json');
        const parsed = isJson ? JSON.parse(data) : data;
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, statusText: res.statusMessage, body: parsed, isJson });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function makeRecordReplayFetch(fixtures, key) {
  return async (url, options) => {
    if (IS_RECORDING) {
      const res = await httpsPost(url, options);
      fixtures[key] = { status: res.status, ok: res.ok, statusText: res.statusText, body: res.body };
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        json: async () => res.body,
        text: async () => (typeof res.body === 'string' ? res.body : JSON.stringify(res.body))
      };
    } else {
      const fixture = fixtures[key];
      if (!fixture) throw new Error(`No fixture for "${key}". Run with POLLY_MODE=record first.`);
      return {
        ok: fixture.ok,
        status: fixture.status,
        statusText: fixture.statusText,
        json: async () => fixture.body,
        text: async () => (typeof fixture.body === 'string' ? fixture.body : JSON.stringify(fixture.body))
      };
    }
  };
}

describe('Slack Send Message - Record & Replay', () => {
  let fixtures = {};

  beforeAll(() => {
    fixtures = loadFixtures();
  });

  afterAll(() => {
    if (IS_RECORDING) saveFixtures(fixtures);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const apiContext = {
    environment: { ADDRESS: 'https://slack.com' },
    secrets: { BEARER_AUTH_TOKEN: process.env.SLACK_BOT_TOKEN || 'xoxb-fake-token' },
    outputs: {}
  };

  test('should send message via API', async () => {
    fetch.mockImplementationOnce(makeRecordReplayFetch(fixtures, 'api-send-message'));

    const result = await script.invoke({
      text: 'Hello from record-replay test!',
      channel: process.env.SLACK_CHANNEL_ID || 'C1234567890',
      isWebhook: false
    }, apiContext);

    expect(result.status).toBe('success');
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('api');
  });

  test('should handle channel_not_found error', async () => {
    fetch.mockImplementationOnce(makeRecordReplayFetch(fixtures, 'api-channel-not-found'));

    await expect(script.invoke({
      text: 'Hello!',
      channel: 'C_INVALID',
      isWebhook: false
    }, apiContext)).rejects.toThrow('Slack API error: channel_not_found');
  });

  test('should send message via webhook', async () => {
    fetch.mockImplementationOnce(makeRecordReplayFetch(fixtures, 'webhook-send-message'));

    const result = await script.invoke({
      text: 'Hello from webhook record-replay!',
      isWebhook: true
    }, {
      environment: {
        ADDRESS: process.env.SLACK_WEBHOOK_URL ||
          'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX'
      },
      secrets: {},
      outputs: {}
    });

    expect(result.status).toBe('success');
    expect(result.mode).toBe('webhook');
  });

  test('should handle two identical calls (idempotency)', async () => {
    fetch
      .mockImplementationOnce(makeRecordReplayFetch(fixtures, 'idempotency-call-1'))
      .mockImplementationOnce(makeRecordReplayFetch(fixtures, 'idempotency-call-2'));

    const params = {
      text: 'Idempotency test message',
      channel: process.env.SLACK_CHANNEL_ID || 'C1234567890',
      isWebhook: false
    };

    const r1 = await script.invoke(params, apiContext);
    const r2 = await script.invoke(params, apiContext);

    expect(r1.status).toBe('success');
    expect(r2.status).toBe('success');
    expect(r1.ts).not.toBe(r2.ts);
  });
});