/**
 * This script helps with loading environment variables dynamically on the client side.
 * This is especially useful for reCAPTCHA where we need the site key available client-side.
 */
(function() {
  // Initialize environment variable container
  if (typeof window !== 'undefined' && !window.__env) {
    window.__env = {};
  }

  // Debug flag - can be controlled via localStorage for troubleshooting
  const debugMode = localStorage.getItem('env_loader_debug') === 'true';
  
  // Configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // ms
  
  // Tracking state
  let retryCount = 0;
  let loadAttempted = false;
  
  // Helper function for logging
  function log(message, data) {
    if (debugMode) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`[env-loader ${timestamp}] ${message}`, data || '');
    }
  }

  // Helper function for error logging (always shows regardless of debug mode)
  function logError(message, error) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[env-loader ${timestamp}] ${message}`, error || '');
  }
  
  // Helper function for warning logging (always shows regardless of debug mode)
  function logWarning(message, data) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.warn(`[env-loader ${timestamp}] ${message}`, data || '');
  }

  /**
   * Load environment variables from the server
   * and make them available in window.__env
   */
  function loadEnvironmentVariables() {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Record that we've attempted to load
    loadAttempted = true;
    
    log('Starting environment variable loading...', {
      retryCount,
      debugMode,
      windowEnvExists: !!window.__env
    });
    
    // Check if we already have the reCAPTCHA site key
    if (window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      log('Already have reCAPTCHA site key', { 
        keyPrefix: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 6) + '...',
        keyLength: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length
      });
      
      // Still dispatch the loaded event for components waiting for it
      window.dispatchEvent(new CustomEvent('env-loaded', { 
        detail: { 
          success: true,
          fromCache: true
        } 
      }));
      
      return;
    }

    // Add timestamp to avoid caching issues
    const timestamp = new Date().getTime();
    const url = `/api/recaptcha-config?_=${timestamp}`;
    
    log(`Fetching from ${url}`);

    // Fetch status tracking
    let fetchTimedOut = false;
    
    // Create a timeout to abort fetch if it takes too long
    const timeoutId = setTimeout(() => {
      fetchTimedOut = true;
      logWarning('Fetch timeout reached, continuing execution');
      
      // Dispatch timeout event for components waiting
      window.dispatchEvent(new CustomEvent('env-loading-timeout', { 
        detail: { url, timestamp } 
      }));
      
      // Try to recover by setting a reasonable default for development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        logWarning('Development environment detected, setting Google test key as fallback');
        window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
        window.__env.usingTestKey = true;
      }
    }, 5000); // 5 second timeout

    // Try to load from reCAPTCHA config endpoint
    fetch(url)
      .then(response => {
        clearTimeout(timeoutId);
        if (fetchTimedOut) {
          log('Fetch completed after timeout, still processing response');
        }
        
        if (!response.ok) {
          throw new Error(`Failed to load reCAPTCHA config: ${response.status} ${response.statusText}`);
        }
        log('Received response', { status: response.status });
        return response.json();
      })
      .then(data => {
        log('Received data', { 
          hasConfig: !!data.config,
          hasSiteKey: !!data.siteKey,
          configStatus: data.status,
          isUsingTestKey: data.isUsingTestKey
        });
        
        // If we have a site key, set it
        if (data.siteKey) {
          window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = data.siteKey;
          window.__env.usingTestKey = data.isUsingTestKey;
          
          log('Loaded reCAPTCHA site key', { 
            keyPrefix: data.siteKey.substring(0, 6) + '...',
            length: data.siteKey.length,
            isTestKey: data.isUsingTestKey
          });
          
          // Store configuration details for debugging
          window.__env.recaptchaConfig = data.config;
          
          // Store load timestamp for diagnostics
          window.__env.loadTimestamp = new Date().toISOString();
          
          // Dispatch an event to notify that environment variables are loaded
          window.dispatchEvent(new CustomEvent('env-loaded', { 
            detail: { 
              success: true,
              isTestKey: data.isUsingTestKey
            } 
          }));
        } else {
          logError('reCAPTCHA site key is missing from API response', data);
          
          // The config contains useful debugging info even if the site key is missing
          if (data.config) {
            window.__env.recaptchaConfig = data.config;
          }
          
          window.dispatchEvent(new CustomEvent('env-loaded', { 
            detail: { 
              success: false, 
              error: 'Site key missing from response'
            } 
          }));
          
          // Retry loading if we haven't exceeded retry limit
          retryWithBackoff();
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        logError('Failed to load environment variables', error);
        
        window.dispatchEvent(new CustomEvent('env-loaded', { 
          detail: { 
            success: false, 
            error: error.message
          } 
        }));
        
        // Retry loading if we haven't exceeded retry limit
        retryWithBackoff();
      });
  }
  
  /**
   * Retry loading with exponential backoff
   */
  function retryWithBackoff() {
    if (retryCount < MAX_RETRIES && !window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      retryCount++;
      const delay = RETRY_DELAY * Math.pow(2, retryCount - 1);
      
      logWarning(`Retrying environment variable load in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
      
      setTimeout(() => {
        loadEnvironmentVariables();
      }, delay);
    } else if (!window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      logError(`Failed to load environment variables after ${MAX_RETRIES} retries`);
      
      // Set a flag that we're in a failed state
      window.__env.loadFailed = true;
      
      // Show alert in debug mode
      if (debugMode) {
        // Use console.assert to make this very visible in browser dev tools
        console.assert(false, 'reCAPTCHA environment loading failed. Check network requests, domain configuration, and API keys.');
      }
    }
  }

  // Attempt to load variables immediately
  log('Initializing environment loader');
  loadEnvironmentVariables();

  // Handle "visibilitychange" event to reload variables if the page becomes visible
  // This helps when the tab was in the background during initial load
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && 
        !window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && 
        retryCount === 0 && 
        loadAttempted) {
      log('Page became visible, reloading environment variables');
      loadEnvironmentVariables();
    }
  });

  // Also expose the function globally for manual reloading
  window.loadEnvironmentVariables = loadEnvironmentVariables;
  
  // Expose a debug toggle function
  window.toggleEnvLoaderDebug = function() {
    const newState = localStorage.getItem('env_loader_debug') !== 'true';
    localStorage.setItem('env_loader_debug', newState);
    console.log(`[env-loader] Debug mode ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  };
  
  // Expose a function to check status
  window.checkEnvLoaderStatus = function() {
    const status = {
      hasSiteKey: !!window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
      siteKeyLength: window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length,
      loadAttempted,
      retryCount,
      loadFailed: window.__env?.loadFailed || false,
      usingTestKey: window.__env?.usingTestKey || false,
      loadTimestamp: window.__env?.loadTimestamp,
      recaptchaConfig: window.__env?.recaptchaConfig
    };
    
    console.log('[env-loader] Status:', status);
    return status;
  };
})(); 