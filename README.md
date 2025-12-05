# Slack Send Message Action

Send messages to Slack channels using either webhook or API mode. This action provides flexible integration with Slack, supporting both simple webhook posting and full API access with authentication.

## Overview

This action supports two operating modes:

- **Webhook Mode**: Simple message posting using Slack incoming webhooks
- **API Mode**: Full Slack Web API integration with authentication and channel specification

## Prerequisites

### For Webhook Mode
- A Slack incoming webhook URL (obtained from your Slack workspace settings)

### For API Mode  
- A Slack Bot OAuth token with `chat:write` scope
- Channel ID or name where messages should be sent

## Configuration

### Required Inputs
- `text` (string): Message text to send to Slack channel (max 4000 characters)

### Optional Inputs
- `channel` (string): Slack channel name or ID (required for API mode, ignored for webhook mode)
- `isWebhook` (boolean): Set to `true` to use webhook mode, `false` for API mode (default: `false`)
- `address` (string): Slack API base URL (e.g., https://slack.com). Defaults to https://slack.com

### Environment Variables
- `ADDRESS`: Base URL for Slack API in API mode (defaults to `https://slack.com`), or full webhook URL in webhook mode

### Secrets
- `BEARER_AUTH_TOKEN` (required for API mode): Bot OAuth token (e.g., `xoxb-...`)

## Usage Examples

### Webhook Mode
```javascript
// SGNL JobSpec for webhook mode
{
  "script_inputs": {
    "text": "Alert: User access violation detected",
    "isWebhook": true
  },
  "environment": {
    "ADDRESS": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
  }
}
```

### API Mode
```javascript
// SGNL JobSpec for API mode
{
  "script_inputs": {
    "text": "User provisioned successfully",
    "channel": "#security-alerts",
    "isWebhook": false
  },
  "environment": {
    "ADDRESS": "https://slack.com"
  },
  "secrets": {
    "BEARER_AUTH_TOKEN": "xoxb-your-bot-token"
  }
}
```

## Outputs

### Webhook Mode
- `status`: Operation status (`success`, `failed`)
- `text`: The message text that was sent
- `ok`: Whether webhook returned 'ok' response
- `mode`: Always `"webhook"`

### API Mode
- `status`: Operation status (`success`, `failed`)  
- `text`: The message text that was sent
- `channel`: The channel where message was sent
- `ts`: Message timestamp from Slack API
- `ok`: Whether Slack API response was successful
- `mode`: Always `"api"`

## Error Handling

The action includes comprehensive error handling:

### Retryable Errors
- **Rate limiting (429)**: Automatic retry after 5-second delay
- **Server errors (502, 503, 504)**: Framework will retry with exponential backoff
- **Network timeouts**: Framework will retry

### Fatal Errors (No Retry)
- **Authentication errors (401, 403)**: Invalid token or insufficient permissions
- **Validation errors**: Missing required parameters, invalid channel
- **Channel not found**: Specified channel doesn't exist or bot lacks access

## Security Considerations

- **Token Security**: Bot tokens are stored as secrets and never logged
- **URL Validation**: Webhook URLs should be validated before use
- **Message Size**: Messages are limited to 4000 characters as per Slack limits
- **Rate Limiting**: Action respects Slack's rate limits with built-in retry logic

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Check test coverage (80% required)
npm run test:coverage

# Lint code
npm run lint

# Build distribution
npm run build

# Test locally with parameters
npm run dev -- --params '{"text":"Test message","isWebhook":true}'
```

### Testing Different Modes

```bash
# Test webhook mode
npm run dev -- --params '{"text":"Hello webhook!","isWebhook":true}' --env '{"ADDRESS":"https://hooks.slack.com/services/..."}'

# Test API mode  
npm run dev -- --params '{"text":"Hello API!","channel":"#test"}' --secrets '{"BEARER_AUTH_TOKEN":"xoxb-..."}'
```

## Troubleshooting

### Common Issues

1. **"channel_not_found" error**
   - Ensure bot is added to the channel
   - Verify channel name includes # prefix for public channels
   - Use channel ID instead of name for private channels

2. **"invalid_auth" error**
   - Check bot token is correct and starts with `xoxb-`
   - Verify token has `chat:write` scope
   - Ensure token hasn't been revoked

3. **Webhook "invalid_payload" error**
   - Verify webhook URL is correct and active
   - Check message isn't empty
   - Ensure JSON payload is properly formatted

4. **Rate limiting**
   - Action automatically retries after rate limit delays
   - Consider reducing message frequency if persistent

## Slack Setup

### Creating a Webhook
1. Go to your Slack workspace settings
2. Navigate to "Incoming Webhooks"
3. Click "Add New Webhook to Workspace"
4. Select target channel and authorize
5. Copy the webhook URL for use in `ADDRESS` environment variable

### Creating a Bot Token
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create new app or select existing app
3. Go to "OAuth & Permissions"
4. Add `chat:write` scope under Bot Token Scopes
5. Install app to workspace
6. Copy "Bot User OAuth Token" for use in `BEARER_AUTH_TOKEN`
7. Invite bot to channels where it should post messages