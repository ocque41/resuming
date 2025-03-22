/**
 * This script helps with loading environment variables dynamically on the client side.
 * This is especially useful for reCAPTCHA where we need the site key available client-side.
 */
(function() {
  // Initialize environment variable container
  if (typeof window !== 'undefined' && !window.__env) {
    window.__env = {};
  }

  /**
   * Load environment variables from the server
   * and make them available in window.__env
   */
  function loadEnvironmentVariables() {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Check if we already have the reCAPTCHA site key
    if (window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      console.log("env-loader: Already have reCAPTCHA site key");
      return;
    }

    // Try to load from reCAPTCHA config endpoint
    fetch('/api/recaptcha-config')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load reCAPTCHA config: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // If we have a site key (either from test or dev environment), set it
        if (data.siteKey) {
          window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = data.siteKey;
          console.log("env-loader: Loaded reCAPTCHA site key from API");
        } else if (data.config.isSiteKeyConfigured) {
          // We know there's a site key configured, but we don't want to expose it
          // This helps debugging while maintaining security
          console.log("env-loader: reCAPTCHA site key is configured on server but not exposed to client");
        }
        
        // Store config details for debugging
        window.__env.recaptchaConfig = data.config;
        
        // Dispatch an event to notify that environment variables are loaded
        window.dispatchEvent(new CustomEvent('env-loaded'));
      })
      .catch(error => {
        console.error("env-loader: Failed to load environment variables", error);
      });
  }

  // Load variables immediately
  loadEnvironmentVariables();

  // Also expose the function globally for manual reloading
  window.loadEnvironmentVariables = loadEnvironmentVariables;
})(); 