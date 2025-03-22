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
  
  // Helper function for logging
  function log(message, data) {
    if (debugMode) {
      console.log(`[env-loader] ${message}`, data);
    }
  }

  // Helper function for error logging
  function logError(message, error) {
    console.error(`[env-loader] ${message}`, error);
  }

  /**
   * Load environment variables from the server
   * and make them available in window.__env
   */
  function loadEnvironmentVariables() {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    log('Starting environment variable loading...');
    
    // Check if we already have the reCAPTCHA site key
    if (window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      log('Already have reCAPTCHA site key', { 
        keyPrefix: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 6) + '...' 
      });
      return;
    }

    // Add timestamp to avoid caching issues
    const timestamp = new Date().getTime();
    const url = `/api/recaptcha-config?_=${timestamp}`;
    
    log(`Fetching from ${url}`);

    // Try to load from reCAPTCHA config endpoint
    fetch(url)
      .then(response => {
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
          configStatus: data.status
        });
        
        // If we have a site key, set it
        if (data.siteKey) {
          window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = data.siteKey;
          log('Loaded reCAPTCHA site key', { 
            keyPrefix: data.siteKey.substring(0, 6) + '...',
            length: data.siteKey.length
          });
          
          // Store configuration details for debugging
          window.__env.recaptchaConfig = data.config;
          
          // Dispatch an event to notify that environment variables are loaded
          window.dispatchEvent(new CustomEvent('env-loaded', { detail: { success: true } }));
        } else {
          logError('reCAPTCHA site key is missing from API response', data);
          window.dispatchEvent(new CustomEvent('env-loaded', { 
            detail: { 
              success: false, 
              error: 'Site key missing from response'
            } 
          }));
        }
      })
      .catch(error => {
        logError('Failed to load environment variables', error);
        window.dispatchEvent(new CustomEvent('env-loaded', { 
          detail: { 
            success: false, 
            error: error.message
          } 
        }));
      });
  }

  // Attempt to load variables immediately
  log('Initializing environment loader');
  loadEnvironmentVariables();

  // Also expose the function globally for manual reloading
  window.loadEnvironmentVariables = loadEnvironmentVariables;
  
  // Expose a debug toggle function
  window.toggleEnvLoaderDebug = function() {
    const newState = localStorage.getItem('env_loader_debug') !== 'true';
    localStorage.setItem('env_loader_debug', newState);
    console.log(`[env-loader] Debug mode ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  };
})(); 