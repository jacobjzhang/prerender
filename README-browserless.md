# Using Prerender with Remote Chrome via WebSocket

This guide explains how to deploy Prerender with a remote Chrome instance (like Browserless) on Railway, avoiding the need to install Chrome in your Prerender container.

## Overview

Instead of spawning Chrome locally, this setup connects Prerender to a remote Chrome instance via WebSocket using the `BROWSER_WS_ENDPOINT` environment variable. This is ideal for platforms like Railway where installing Chrome can be problematic.

The adapter supports two connection methods:
1. **Direct Chrome DevTools WebSocket** - For raw Chrome instances (e.g., `ws://localhost:9222/devtools/browser/...`)
2. **Browserless Service URL** - For Browserless.io instances with authentication (e.g., `ws://browserless.example.com/?token=YOUR_TOKEN`)

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

4. If using Browserless with authentication, get your token and WebSocket URL:
   ```
   ws://browserless.railway.internal:3000/?token=YOUR_TOKEN
   ```
   Or for public Browserless instances:
   ```
   ws://browserless-production.up.railway.app/?token=YOUR_TOKEN
   ```

### 2. Deploy Prerender on Railway

1. In your Prerender project, set the following environment variable:
   ```
   # For Browserless with authentication:
   BROWSER_WS_ENDPOINT=ws://browserless-production.up.railway.app/?token=YOUR_TOKEN
   
   # For local/internal Browserless without auth:
   BROWSER_WS_ENDPOINT=ws://browserless.railway.internal:3000
   
   # For direct Chrome DevTools:
   BROWSER_WS_ENDPOINT=ws://chrome:9222/devtools/browser/abc-123...
   ```
   Replace with your actual endpoint.

2. Deploy your Prerender service to Railway. The service will automatically detect the `BROWSER_WS_ENDPOINT` and use the Browserless adapter instead of trying to spawn Chrome locally.

### 3. Configuration Options

You can pass the WebSocket endpoint either as an environment variable or in your Prerender initialization:

```javascript
const prerender = require('prerender');
const server = prerender({
  // For Browserless with token:
  browserWsEndpoint: 'ws://browserless.example.com/?token=YOUR_TOKEN',
  
  // Or for direct Chrome DevTools:
  // browserWsEndpoint: 'ws://localhost:9222/devtools/browser/...',
  
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
   # For local Browserless:
   export BROWSER_WS_ENDPOINT=ws://localhost:3000
   
   # Or if Browserless requires a token locally:
   export BROWSER_WS_ENDPOINT=ws://localhost:3000/?token=LOCAL_TOKEN
   ```

3. Start your Prerender server normally.

## Benefits

- **No Chrome Installation**: No need to install Chrome and its dependencies in your Prerender container
- **Smaller Container Size**: Prerender container remains lightweight
- **Better Resource Management**: Chrome processes are managed by Browserless
- **Scalability**: Can scale Browserless independently from Prerender

## Troubleshooting

1. **Connection Errors**: 
   - Ensure your Browserless instance is running and accessible
   - Check if authentication token is required and properly included
   - Verify the WebSocket URL format matches your Chrome instance type

2. **Authentication Issues**:
   - For Browserless.io, ensure your token is included in the URL: `?token=YOUR_TOKEN`
   - The adapter will automatically handle token authentication

3. **Performance**: Consider running multiple Browserless instances for high traffic

4. **Timeouts**: Adjust `PAGE_LOAD_TIMEOUT` if needed for slower pages

## Additional Browserless Features

Browserless provides additional features you might find useful:
- Built-in debugging tools
- Session management
- Resource limits
- PDF generation optimizations

For more Browserless configuration options, see: https://www.browserless.io/docs/