# Using Prerender with Remote Chrome via WebSocket

This guide explains how to deploy Prerender with a remote Chrome instance (like Browserless) on Railway, avoiding the need to install Chrome in your Prerender container.

## Overview

Instead of spawning Chrome locally, this setup connects Prerender to a remote Chrome instance via WebSocket using the `BROWSER_WS_ENDPOINT` environment variable. This is ideal for platforms like Railway where installing Chrome can be problematic.

## Setup Instructions

### 1. Deploy Browserless on Railway

First, deploy a Browserless instance on Railway:

1. Go to Railway and create a new project
2. Deploy Browserless using their template or Docker image:
   ```
   ghcr.io/browserless/chrome:latest
   ```
3. Configure the Browserless service with these environment variables:
   - `MAX_CONCURRENT_SESSIONS=10` (adjust based on your needs)
   - `PREBOOT_CHROME=true` (improves performance)
   - `WORKSPACE_DIR=/tmp/workspace`
   - `PORT=3000`

4. Get the WebSocket endpoint URL from your Browserless service. It will be in the format:
   ```
   ws://browserless.railway.internal:3000
   ```

### 2. Deploy Prerender on Railway

1. In your Prerender project, set the following environment variable:
   ```
   BROWSER_WS_ENDPOINT=ws://browserless.railway.internal:3000
   ```
   Replace with your actual Browserless WebSocket endpoint.

2. Deploy your Prerender service to Railway. The service will automatically detect the `BROWSER_WS_ENDPOINT` and use the Browserless adapter instead of trying to spawn Chrome locally.

### 3. Configuration Options

You can pass the WebSocket endpoint either as an environment variable or in your Prerender initialization:

```javascript
const prerender = require('prerender');
const server = prerender({
  browserWsEndpoint: 'ws://browserless.railway.internal:3000',
  // other options...
});
server.start();
```

### 4. Testing Locally

To test locally with a Browserless instance:

1. Run Browserless locally:
   ```bash
   docker run -p 3000:3000 ghcr.io/browserless/chrome:latest
   ```

2. Set the environment variable:
   ```bash
   export BROWSER_WS_ENDPOINT=ws://localhost:3000
   ```

3. Start your Prerender server normally.

## Benefits

- **No Chrome Installation**: No need to install Chrome and its dependencies in your Prerender container
- **Smaller Container Size**: Prerender container remains lightweight
- **Better Resource Management**: Chrome processes are managed by Browserless
- **Scalability**: Can scale Browserless independently from Prerender

## Troubleshooting

1. **Connection Errors**: Ensure your Browserless instance is running and accessible from your Prerender service
2. **Performance**: Consider running multiple Browserless instances for high traffic
3. **Timeouts**: Adjust `PAGE_LOAD_TIMEOUT` if needed for slower pages

## Additional Browserless Features

Browserless provides additional features you might find useful:
- Built-in debugging tools
- Session management
- Resource limits
- PDF generation optimizations

For more Browserless configuration options, see: https://www.browserless.io/docs/