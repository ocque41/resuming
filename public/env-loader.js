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
  
  // *** PRODUCTION SITE KEY - Only used for resuming.ai domain ***
  // This is the public site key which is safe to include in client code
  // as it's designed to be public-facing and is domain-restricted by Google
  const RESUMING_PROD_SITE_KEY = '6LcX-vwqAAAAAMdAK0K7JlSyCqO6GOp27myEnlh2';
  
  // Google's test key for development
  const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
  
  // Tracking state
  let retryCount = 0;
  let isLoading = false;
  
  // Event names
  const ENV_LOADED_EVENT = 'env_variables_loaded';
  const ENV_LOAD_ERROR_EVENT = 'env_variables_error';
  
  // Get current timestamp for logging
  function getTimestamp() {
    return new Date().toISOString();
  }
  
  // Logging functions
  function log(message, data) {
    if (debugMode || isProductionDomain()) {
      console.log(`[${getTimestamp()}] [ENV-LOADER] ${message}`, data || '');
    }
  }
  
  function logError(message, error) {
    console.error(`[${getTimestamp()}] [ENV-LOADER ERROR] ${message}`, error || '');
    window.__env.lastError = { message, timestamp: new Date().toISOString() };
  }
  
  function logWarning(message, data) {
    console.warn(`[${getTimestamp()}] [ENV-LOADER WARNING] ${message}`, data || '');
  }
  
  // Helper functions for domain detection
  function getCurrentDomain() {
    return window.location.hostname;
  }
  
  // Check if current domain is a production domain
  function isProductionDomain() {
    const domain = getCurrentDomain();
    return PRODUCTION_DOMAINS.includes(domain);
  }
  
  // Check if current domain is a development domain
  function isDevelopmentDomain() {
    const domain = getCurrentDomain();
    return domain === 'localhost' || 
           domain === '127.0.0.1' || 
           domain.endsWith('.local') || 
           domain.endsWith('.test') ||
           domain.includes('vercel.app');
  }
  
  // Get the appropriate site key based on the current domain
  function getSiteKeyForDomain() {
    const domain = getCurrentDomain();
    
    // For resuming.ai domains, use the hardcoded production key
    if (PRODUCTION_DOMAINS.includes(domain)) {
      log(`Using hardcoded production site key for ${domain}`, { 
        keyLength: RESUMING_PROD_SITE_KEY.length,
        domain
      });
      return RESUMING_PROD_SITE_KEY;
    }
    
    // For development domains, use test key or the one from env variables
    if (isDevelopmentDomain()) {
      // Check if we have one in window.__env first
      const envKey = window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (envKey && envKey.length > 10) {
        log(`Using environment site key for development`, { domain });
        return envKey;
      }
      
      // Fallback to test key for development
      log(`Using Google test site key for development`, { domain });
      return TEST_SITE_KEY;
    }
    
    // For all other domains, try to use environment variable
    // or fall back to test key as last resort
    const envKey = window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (envKey && envKey.length > 10) {
      log(`Using environment site key for non-production domain`, { domain });
      return envKey;
    }
    
    logWarning(`Falling back to test key for domain: ${domain}`);
    return TEST_SITE_KEY;
  }
  
  // Get fallback environment variables when API fails
  function getEnvFallbackSettings() {
    const domain = getCurrentDomain();
    
    // Store domain information
    window.__env.domain = domain;
    window.__env.isProductionDomain = isProductionDomain();
    window.__env.isDevelopmentDomain = isDevelopmentDomain();
    
    // If we're on resuming.ai, we should always use production site key
    if (PRODUCTION_DOMAINS.includes(domain)) {
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = RESUMING_PROD_SITE_KEY;
      window.__env.usingTestKey = false;
      log(`Fallback: Using production key for ${domain}`);
    } else if (isDevelopmentDomain()) {
      // For development domains, use test key
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = TEST_SITE_KEY;
      window.__env.usingTestKey = true;
      log(`Fallback: Using test key for development domain ${domain}`);
    } else {
      // For other domains, use test key as fallback
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = TEST_SITE_KEY;
      window.__env.usingTestKey = true;
      logWarning(`Fallback: Using test key for unknown domain ${domain}`);
    }
    
    return window.__env;
  }
  
  // Main function to load environment variables
  function loadEnvironmentVariables() {
    if (isLoading) {
      log('Already loading environment variables');
      return;
    }
    
    isLoading = true;
    const domain = getCurrentDomain();
    log(`Loading environment variables for domain: ${domain}`);
    
    // Special handling for production domains (resuming.ai)
    if (PRODUCTION_DOMAINS.includes(domain)) {
      log(`Production domain detected: ${domain}`);
      
      // For resuming.ai, directly set the site key without API call for reliability
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = RESUMING_PROD_SITE_KEY;
      window.__env.domain = domain;
      window.__env.isProductionDomain = true;
      window.__env.isDevelopmentDomain = false;
      window.__env.usingTestKey = false;
      
      log(`Directly setting production site key for ${domain}`);
      
      // Still try the API for any other env vars, but don't block on it
      fetch('/api/env')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error loading environment variables: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          log('Additional environment variables loaded from API', data);
          // Merge any additional vars, but keep our hardcoded site key
          const siteKey = window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
          Object.assign(window.__env, data);
          window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = siteKey;
          
          // Dispatch event for additional vars
          dispatchEvent(new CustomEvent(ENV_LOADED_EVENT, { detail: window.__env }));
        })
        .catch(error => {
          logWarning(`Could not load additional env vars from API, continuing with hardcoded values`, error);
        })
        .finally(() => {
          isLoading = false;
        });
      
      // On production domains, dispatch success immediately after setting the key
      // Don't wait for the API call which is just for additional vars
      dispatchEvent(new CustomEvent(ENV_LOADED_EVENT, { detail: window.__env }));
      return;
    }
    
    // For non-production domains, use the API approach with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout loading environment variables')), 5000);
    });
    
    Promise.race([
      fetch('/api/env'),
      timeoutPromise
    ])
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error loading environment variables: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        log('Environment variables loaded', data);
        
        // Store the data in window.__env
        Object.assign(window.__env, data);
        
        // Add domain information
        window.__env.domain = domain;
        window.__env.isProductionDomain = isProductionDomain();
        window.__env.isDevelopmentDomain = isDevelopmentDomain();
        
        // Check if we got a site key, if not use our domain-specific logic
        if (!window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
          window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = getSiteKeyForDomain();
          
          // Check if we're using test key
          window.__env.usingTestKey = window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY === TEST_SITE_KEY;
          
          log('Using domain-specific site key', {
            keyLength: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length,
            isTestKey: window.__env.usingTestKey,
            domain
          });
        }
        
        // Dispatch event to notify that environment variables are loaded
        dispatchEvent(new CustomEvent(ENV_LOADED_EVENT, { detail: window.__env }));
        
        // Reset retry count on success
        retryCount = 0;
      })
      .catch(error => {
        logError('Failed to load environment variables', error);
        
        // Set fallback environment variables
        getEnvFallbackSettings();
        
        // Dispatch error event
        dispatchEvent(new CustomEvent(ENV_LOAD_ERROR_EVENT, { 
          detail: { error: error.message, retry: retryCount } 
        }));
        
        // Retry with exponential backoff
        retryWithBackoff();
      })
      .finally(() => {
        isLoading = false;
      });
  }
  
  // Retry with exponential backoff
  function retryWithBackoff() {
    if (retryCount >= MAX_RETRIES) {
      logError(`Maximum retry attempts (${MAX_RETRIES}) reached. Using fallback values.`);
      return;
    }
    
    retryCount++;
    const delay = RETRY_DELAY * Math.pow(2, retryCount - 1);
    
    log(`Retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
    
    setTimeout(() => {
      loadEnvironmentVariables();
    }, delay);
  }
  
  // Initialize environment variables
  log('Initializing environment variables loader');
  loadEnvironmentVariables();
  
  // Listen for page visibility changes to refresh when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isLoading) {
      log('Page became visible, refreshing environment variables');
      loadEnvironmentVariables();
    }
  });
  
  // Add a public refresh method
  window.__refreshEnv = loadEnvironmentVariables;
  
  // Add a debug toggle
  window.__toggleEnvDebug = function(enable) {
    const newState = enable === undefined ? !debugMode : !!enable;
    localStorage.setItem('env_loader_debug', newState);
    log(`Debug mode ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  };
})(); 