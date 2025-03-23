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
  const MAX_RETRIES = 5; // Increase max retries for production
  const RETRY_DELAY = 1000; // ms
  const PRODUCTION_DOMAINS = ['resuming.ai', 'www.resuming.ai'];
  const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
  const USER_SITE_KEY = '6LcX-vwqAAAAAMdAK0K7JlSyCqO6GOp27myEnlh2';
  
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
   * Helper to determine if we're on a production domain
   */
  function isProductionDomain() {
    const hostname = window.location.hostname.toLowerCase();
    const isProd = PRODUCTION_DOMAINS.includes(hostname);
    
    if (isProd && debugMode) {
      log(`Production domain detected: ${hostname}`);
    }
    
    return isProd;
  }

  /**
   * Helper to determine if we're on a development domain
   */
  function isDevelopmentDomain() {
    const hostname = window.location.hostname.toLowerCase();
    const isDev = hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.endsWith('.local') || 
           hostname.endsWith('.test');
    
    if (isDev && debugMode) {
      log(`Development domain detected: ${hostname}`);
    }
    
    return isDev;
  }

  /**
   * Get the appropriate site key based on the current domain
   */
  function getSiteKeyForDomain() {
    // For production domains, use the user's site key
    if (isProductionDomain()) {
      log('Production domain detected, using production site key');
      // Always use the hardcoded site key on production domains for reliability
      return USER_SITE_KEY;
    }
    
    // For development domains, use Google's test key
    if (isDevelopmentDomain()) {
      log('Development domain detected, using Google test key');
      return TEST_SITE_KEY;
    }
    
    // For unknown domains, try the user's site key first
    log('Unknown domain, defaulting to production site key');
    return USER_SITE_KEY;
  }

  /**
   * Get appropriate environment settings when API fails
   */
  function getEnvFallbackSettings() {
    const isProdDomain = isProductionDomain();
    const isDevDomain = isDevelopmentDomain();
    
    return {
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: getSiteKeyForDomain(),
      isProductionDomain: isProdDomain,
      isDevelopmentDomain: isDevDomain,
      usingTestKey: !isProdDomain && isDevDomain,
      domain: window.location.hostname,
      loadSource: 'fallback',
      loadTimestamp: new Date().toISOString()
    };
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
      windowEnvExists: !!window.__env,
      hostname: window.location.hostname,
      isProduction: isProductionDomain(),
      isDevelopment: isDevelopmentDomain()
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

    // Priority - if we're on production domain, set the site key immediately
    // while we load from the API to ensure it's never missing
    if (isProductionDomain()) {
      log('Production domain detected, setting initial site key while API loads');
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = USER_SITE_KEY;
      window.__env.isProductionDomain = true;
      window.__env.domain = window.location.hostname;
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
      logWarning('Fetch timeout reached, using fallback configuration');
      
      // Dispatch timeout event for components waiting
      window.dispatchEvent(new CustomEvent('env-loading-timeout', { 
        detail: { url, timestamp } 
      }));
      
      // Set fallback values based on domain
      const fallbackSettings = getEnvFallbackSettings();
      Object.assign(window.__env, fallbackSettings);
      
      // Log the fallback settings we're using
      log('Using fallback settings due to API timeout', fallbackSettings);
      
      // Dispatch an event to notify that environment variables are loaded
      window.dispatchEvent(new CustomEvent('env-loaded', { 
        detail: { 
          success: true,
          isTestKey: fallbackSettings.usingTestKey,
          fromFallback: true
        } 
      }));
    }, 5000); // 5 second timeout

    // Try to load from reCAPTCHA config endpoint
    fetch(url)
      .then(response => {
        clearTimeout(timeoutId);
        if (fetchTimedOut) {
          log('Fetch completed after timeout, still processing response');
          return null; // Skip further processing if we already used fallback
        }
        
        if (!response.ok) {
          throw new Error(`Failed to load reCAPTCHA config: ${response.status} ${response.statusText}`);
        }
        log('Received response', { status: response.status });
        return response.json();
      })
      .then(data => {
        // Skip if we already used fallback due to timeout
        if (fetchTimedOut || !data) return;
        
        log('Received data', { 
          hasConfig: !!data.config,
          hasSiteKey: !!data.siteKey,
          configStatus: data.status,
          isUsingTestKey: data.isUsingTestKey
        });
        
        // If we have a site key, set it
        if (data.siteKey) {
          // If on production domain, don't override with test keys
          if (isProductionDomain() && data.isUsingTestKey) {
            logWarning('Production domain - ignoring test key from API, using production key');
            window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = USER_SITE_KEY;
            window.__env.usingTestKey = false;
          } else {
            window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = data.siteKey;
            window.__env.usingTestKey = data.isUsingTestKey;
          }
          
          window.__env.isProductionDomain = isProductionDomain();
          window.__env.isDevelopmentDomain = isDevelopmentDomain();
          window.__env.domain = window.location.hostname;
          window.__env.loadSource = 'api';
          
          log('Loaded reCAPTCHA site key', { 
            keyPrefix: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 6) + '...',
            length: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length,
            isTestKey: window.__env.usingTestKey
          });
          
          // Store configuration details for debugging
          window.__env.recaptchaConfig = data.config;
          
          // Store load timestamp for diagnostics
          window.__env.loadTimestamp = new Date().toISOString();
          
          // Dispatch an event to notify that environment variables are loaded
          window.dispatchEvent(new CustomEvent('env-loaded', { 
            detail: { 
              success: true,
              isTestKey: window.__env.usingTestKey
            } 
          }));
        } else {
          logError('reCAPTCHA site key is missing from API response', data);
          
          // The config contains useful debugging info even if the site key is missing
          if (data.config) {
            window.__env.recaptchaConfig = data.config;
          }
          
          // Use fallback settings
          const fallbackSettings = getEnvFallbackSettings();
          Object.assign(window.__env, fallbackSettings);
          
          log('Using fallback settings due to missing site key', fallbackSettings);
          
          window.dispatchEvent(new CustomEvent('env-loaded', { 
            detail: { 
              success: true, 
              fromFallback: true,
              isTestKey: fallbackSettings.usingTestKey
            } 
          }));
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        
        // Skip if we already used fallback due to timeout
        if (fetchTimedOut) return;
        
        logError('Failed to load environment variables', error);
        
        // Use fallback settings for retry logic
        if (retryCount < MAX_RETRIES) {
          // Retry loading
          retryWithBackoff();
        } else {
          // Max retries reached, use fallback settings
          const fallbackSettings = getEnvFallbackSettings();
          Object.assign(window.__env, fallbackSettings);
          
          log('Using fallback settings after max retries', fallbackSettings);
          
          window.dispatchEvent(new CustomEvent('env-loaded', { 
            detail: { 
              success: true, 
              fromFallback: true,
              afterRetries: true,
              isTestKey: fallbackSettings.usingTestKey
            } 
          }));
        }
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
      
      // Use fallback settings as last resort
      const fallbackSettings = getEnvFallbackSettings();
      Object.assign(window.__env, fallbackSettings);
      
      log('Using fallback settings after load failure', fallbackSettings);
      
      window.dispatchEvent(new CustomEvent('env-loaded', { 
        detail: { 
          success: true, 
          fromFallback: true,
          afterFailure: true,
          isTestKey: fallbackSettings.usingTestKey
        } 
      }));
      
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
      isProductionDomain: window.__env?.isProductionDomain || isProductionDomain(),
      isDevelopmentDomain: window.__env?.isDevelopmentDomain || isDevelopmentDomain(),
      domain: window.__env?.domain || window.location.hostname,
      loadSource: window.__env?.loadSource || 'unknown',
      loadTimestamp: window.__env?.loadTimestamp,
      recaptchaConfig: window.__env?.recaptchaConfig
    };
    
    console.log('[env-loader] Status:', status);
    return status;
  };
})(); 