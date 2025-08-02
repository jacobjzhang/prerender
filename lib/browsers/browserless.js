const CDP = require('chrome-remote-interface');
const util = require('../util.js');

const browserless = {};

browserless.name = 'Browserless';

// No local Chrome spawn needed
browserless.spawn = function (options) {
  this.options = options;
  return Promise.resolve();
};

// No local Chrome process to close
browserless.onClose = function (callback) {
  // No-op for browserless
};

// No local Chrome process to kill
browserless.kill = function () {
  // No-op for browserless
};

// Connect to remote browserless instance
browserless.connect = function () {
  return new Promise(async (resolve, reject) => {
    const browserWsEndpoint = this.options.browserWsEndpoint || process.env.BROWSER_WS_ENDPOINT;
    
    if (!browserWsEndpoint) {
      util.log('BROWSER_WS_ENDPOINT not provided. Please set BROWSER_WS_ENDPOINT environment variable or pass browserWsEndpoint option');
      return reject(new Error('BROWSER_WS_ENDPOINT not configured'));
    }

    util.log(`Connecting to browser via BROWSER_WS_ENDPOINT: ${browserWsEndpoint}`);
    
    let connected = false;
    let timeout = setTimeout(() => {
      if (!connected) {
        reject(new Error('Timeout connecting to browser WebSocket endpoint'));
      }
    }, 20 * 1000);

    try {
      // Check if this is a Browserless service URL (contains token parameter)
      const url = new URL(browserWsEndpoint);
      const isBrowserlessService = url.searchParams.has('token') || 
                                   url.pathname === '/' || 
                                   !url.pathname.includes('/devtools/browser/');
      
      if (isBrowserlessService) {
        // For Browserless service, we need to get the actual Chrome WebSocket endpoint
        util.log('Detected Browserless service URL, fetching Chrome WebSocket endpoint...');
        
        // Convert ws:// to http:// or wss:// to https://
        const httpUrl = browserWsEndpoint.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
        const versionUrl = new URL('/json/version', httpUrl).toString();
        
        try {
          const https = require('https');
          const http = require('http');
          
          const info = await new Promise((resolveInfo, rejectInfo) => {
            const urlObj = new URL(versionUrl);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            // Include token in headers if present
            const headers = {};
            const token = url.searchParams.get('token');
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const options = {
              headers: headers
            };
            
            client.get(versionUrl, options, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  resolveInfo(JSON.parse(data));
                } catch (e) {
                  rejectInfo(new Error('Failed to parse browser info'));
                }
              });
            }).on('error', rejectInfo);
          });
          
          this.webSocketDebuggerURL = info.webSocketDebuggerUrl;
          
          // If we have a token, append it to the WebSocket URL
          if (token) {
            const wsUrl = new URL(this.webSocketDebuggerURL);
            wsUrl.searchParams.set('token', token);
            this.webSocketDebuggerURL = wsUrl.toString();
          }
          
          this.originalUserAgent = info['User-Agent'] || 'Chrome (via Browserless)';
          this.version = info.Browser || 'Remote Chrome';
          
          util.log(`Got Chrome WebSocket endpoint: ${this.webSocketDebuggerURL}`);
        } catch (fetchErr) {
          util.log('Failed to fetch browser info from Browserless:', fetchErr.message);
          return reject(new Error('Failed to get Chrome endpoint from Browserless service'));
        }
      } else {
        // Direct Chrome DevTools WebSocket endpoint
        this.webSocketDebuggerURL = browserWsEndpoint;
        this.originalUserAgent = 'Chrome (via WebSocket)';
        this.version = 'Remote Chrome';
        
        // Test the connection by trying to get version info
        try {
          const info = await CDP.Version({ target: this.webSocketDebuggerURL });
          if (info['User-Agent']) {
            this.originalUserAgent = info['User-Agent'];
          }
          if (info.Browser) {
            this.version = info.Browser;
          }
        } catch (err) {
          util.log('Version check failed, but proceeding with WebSocket endpoint:', err.message);
        }
      }
      
      clearTimeout(timeout);
      connected = true;
      util.log('Successfully connected to browser');
      resolve();
    } catch (err) {
      clearTimeout(timeout);
      util.log('Failed to connect:', err.message);
      reject(err);
    }
  });
};

// Open a new tab/page in the remote browser
browserless.openTab = function (options) {
  return new Promise((resolve, reject) => {
    const url = options?.prerender?.url;
    
    let browserContext = null;
    let browser = null;

    const connectToBrowser = async (target) => {
      let remainingRetries = 5;
      for (;;) {
        try {
          // Connect directly via WebSocket URL or target
          return await CDP({ target });
        } catch (err) {
          util.log(
            `Cannot connect to browser remainingRetries=${remainingRetries}, url=${url}`,
            err,
          );
          if (remainingRetries <= 0) {
            throw err;
          } else {
            remainingRetries -= 1;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    };

    connectToBrowser(this.webSocketDebuggerURL)
      .then((chromeBrowser) => {
        browser = chromeBrowser;
        return browser.Target.createBrowserContext();
      })
      .then(({ browserContextId }) => {
        browserContext = browserContextId;
        return browser.Target.createTarget({
          url: 'about:blank',
          browserContextId,
        });
      })
      .then(({ targetId }) => {
        return connectToBrowser(targetId);
      })
      .then((tab) => {
        // Reuse the same tab state structure as chrome.js
        tab.browserContextId = browserContext;
        tab.browser = browser;
        tab.prerender = options;
        tab.prerender.errors = [];
        tab.prerender.requests = {};
        tab.prerender.numRequestsInFlight = 0;

        // Import setUpEvents from chrome module
        const chrome = require('./chrome');
        return chrome.setUpEvents.call(this, tab);
      })
      .then((tab) => {
        resolve(tab);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

// Reuse all other methods from chrome.js since they work over CDP
const chrome = require('./chrome');
browserless.closeTab = chrome.closeTab;
browserless.setUpEvents = chrome.setUpEvents;
browserless.loadUrlThenWaitForPageLoadEvent = chrome.loadUrlThenWaitForPageLoadEvent;
browserless.checkIfPageIsDoneLoading = chrome.checkIfPageIsDoneLoading;
browserless.executeJavascript = chrome.executeJavascript;
browserless.parseHtmlFromPage = chrome.parseHtmlFromPage;
browserless.captureScreenshot = chrome.captureScreenshot;
browserless.printToPDF = chrome.printToPDF;
browserless.getHarFile = chrome.getHarFile;

module.exports = browserless;