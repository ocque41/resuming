'use client';

import React, { useState, useEffect } from 'react';
import { useReCaptchaContext } from '@/lib/recaptcha/recaptcha-context';

/**
 * Debug page for testing reCAPTCHA configuration
 * This page displays detailed information about the current reCAPTCHA status
 * and allows testing different aspects of the configuration
 */
export default function ReCaptchaDebugPage() {
  const [envVariables, setEnvVariables] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configResponse, setConfigResponse] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [manualSiteKey, setManualSiteKey] = useState('');
  
  // Get reCAPTCHA context
  const {
    isConfigured,
    configStatus,
    verificationStatus,
    verificationMessage,
    executeVerification,
    token,
    siteKey,
    isLoading: recaptchaLoading
  } = useReCaptchaContext();
  
  // Fetch environment variables on component mount
  useEffect(() => {
    const fetchEnvVars = async () => {
      try {
        const response = await fetch('/api/debug/recaptcha-env-check');
        if (!response.ok) {
          throw new Error(`Failed to load environment variables: ${response.status}`);
        }
        const data = await response.json();
        setEnvVariables(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };
    
    const fetchConfigResponse = async () => {
      try {
        const response = await fetch('/api/recaptcha-config');
        if (!response.ok) {
          throw new Error(`Failed to load reCAPTCHA config: ${response.status}`);
        }
        const data = await response.json();
        setConfigResponse(data);
      } catch (error) {
        console.error('Error fetching config:', error);
      }
    };
    
    fetchEnvVars();
    fetchConfigResponse();
  }, []);
  
  // Handle verification test
  const handleVerificationTest = async () => {
    try {
      setTestResult({ status: 'loading', message: 'Executing verification...' });
      const result = await executeVerification();
      if (result) {
        setTestResult({ 
          status: 'success', 
          message: 'Verification successful', 
          token: result.substring(0, 10) + '...' 
        });
      } else {
        setTestResult({ 
          status: 'error', 
          message: 'Verification failed', 
        });
      }
    } catch (error) {
      setTestResult({ 
        status: 'error', 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  };
  
  // Handle manual site key test
  const handleManualTest = async () => {
    if (!manualSiteKey) {
      setError('Please enter a site key');
      return;
    }
    
    try {
      setTestResult({ status: 'loading', message: 'Testing manual site key...' });
      
      // Add reCAPTCHA script with manual key
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${manualSiteKey}`;
      script.async = true;
      
      // Create promise to wait for script load
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
        
        // Set timeout for script load
        setTimeout(() => reject(new Error('Script load timeout')), 5000);
      });
      
      document.head.appendChild(script);
      
      // Wait for script to load
      await loadPromise;
      
      // Test execution with the manual key
      // @ts-ignore - Accessing global grecaptcha
      window.grecaptcha.ready(async () => {
        try {
          // @ts-ignore - Executing with manual key
          const token = await window.grecaptcha.execute(manualSiteKey, { action: 'manual_test' });
          setTestResult({ 
            status: 'success', 
            message: 'Manual key works!', 
            token: token.substring(0, 10) + '...' 
          });
        } catch (error) {
          setTestResult({ 
            status: 'error', 
            message: 'Error executing reCAPTCHA with manual key',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    } catch (error) {
      setTestResult({ 
        status: 'error', 
        message: 'Failed to test manual key',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
  
  // Enable debug logging for env-loader
  const enableDebugLogging = () => {
    // @ts-ignore - Using global function defined in env-loader.js
    if (window.toggleEnvLoaderDebug) {
      // @ts-ignore
      const enabled = window.toggleEnvLoaderDebug();
      alert(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      alert('Debug toggle not available. Check if env-loader.js is loaded.');
    }
  };
  
  // Reload environment variables
  const reloadEnvVars = () => {
    // @ts-ignore - Using global function defined in env-loader.js
    if (window.loadEnvironmentVariables) {
      // @ts-ignore
      window.loadEnvironmentVariables();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      alert('Environment loader not available. Check if env-loader.js is loaded.');
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">reCAPTCHA Debug</h1>
        <p>Loading environment variables...</p>
      </div>
    );
  }
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">reCAPTCHA Debug Page</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-3">Environment Variables</h2>
          {envVariables ? (
            <div>
              <p>
                <strong>Site Key: </strong>
                {envVariables.siteKeyInfo.defined ? (
                  <span className={envVariables.siteKeyInfo.validFormat ? 'text-green-600' : 'text-red-600'}>
                    {envVariables.siteKeyInfo.firstChars}...{envVariables.siteKeyInfo.lastChars} 
                    ({envVariables.siteKeyInfo.length} chars)
                    {envVariables.siteKeyInfo.isTestKey && ' (Test Key)'}
                  </span>
                ) : (
                  <span className="text-red-600">Not defined</span>
                )}
              </p>
              <p>
                <strong>Secret Key: </strong>
                {envVariables.secretKeyInfo.defined ? (
                  <span className={envVariables.secretKeyInfo.validFormat ? 'text-green-600' : 'text-red-600'}>
                    {envVariables.secretKeyInfo.firstChars}...{envVariables.secretKeyInfo.lastChars} 
                    ({envVariables.secretKeyInfo.length} chars)
                    {envVariables.secretKeyInfo.isTestKey && ' (Test Key)'}
                  </span>
                ) : (
                  <span className="text-red-600">Not defined</span>
                )}
              </p>
              <p className="mt-2">
                <strong>Environment: </strong>
                <span className={envVariables.envInfo.isProduction ? 'text-orange-600' : 'text-blue-600'}>
                  {envVariables.envInfo.nodeEnv}
                </span>
              </p>
              <p>
                <strong>Host: </strong>
                <span>{envVariables.envInfo.host}</span>
              </p>
              <div className="mt-2">
                <strong>Status: </strong>
                {envVariables.allVariablesDefined ? (
                  <span className="text-green-600">All variables defined</span>
                ) : (
                  <span className="text-red-600">Missing variables</span>
                )}
              </div>
            </div>
          ) : (
            <p>No environment data available</p>
          )}
        </section>
        
        <section className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-3">reCAPTCHA Context</h2>
          <p>
            <strong>Configured: </strong>
            <span className={isConfigured ? 'text-green-600' : 'text-red-600'}>
              {isConfigured ? 'Yes' : 'No'}
            </span>
          </p>
          <p>
            <strong>Status: </strong>
            <span className={verificationStatus === 'error' ? 'text-red-600' : 
                           verificationStatus === 'success' ? 'text-green-600' : 
                           verificationStatus === 'warning' ? 'text-orange-600' : 'text-blue-600'}>
              {verificationStatus}
            </span>
          </p>
          {verificationMessage && (
            <p>
              <strong>Message: </strong>
              <span>{verificationMessage}</span>
            </p>
          )}
          <p>
            <strong>Site Key: </strong>
            {siteKey ? (
              <span>{siteKey.substring(0, 6)}...</span>
            ) : (
              <span className="text-red-600">Not available</span>
            )}
          </p>
          <p>
            <strong>Token: </strong>
            {token ? (
              <span className="text-green-600">{token.substring(0, 10)}...</span>
            ) : (
              <span className="text-orange-600">No token</span>
            )}
          </p>
          <div className="mt-3">
            <button
              onClick={handleVerificationTest}
              disabled={recaptchaLoading || !isConfigured}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {recaptchaLoading ? 'Loading...' : 'Test Verification'}
            </button>
          </div>
        </section>
        
        <section className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-3">API Response</h2>
          {configResponse ? (
            <div>
              <p>
                <strong>API Status: </strong>
                <span className="text-green-600">{configResponse.status}</span>
              </p>
              <p>
                <strong>Site Key: </strong>
                {configResponse.siteKey ? (
                  <span className="text-green-600">{configResponse.siteKey.substring(0, 6)}...</span>
                ) : (
                  <span className="text-red-600">Not returned</span>
                )}
              </p>
              {configResponse.config && (
                <>
                  <p>
                    <strong>Site Key Configured: </strong>
                    <span className={configResponse.config.isSiteKeyConfigured ? 'text-green-600' : 'text-red-600'}>
                      {configResponse.config.isSiteKeyConfigured ? 'Yes' : 'No'}
                    </span>
                  </p>
                  <p>
                    <strong>Secret Key Exists: </strong>
                    <span className={configResponse.config.secretKeyExists ? 'text-green-600' : 'text-red-600'}>
                      {configResponse.config.secretKeyExists ? 'Yes' : 'No'}
                    </span>
                  </p>
                  <p>
                    <strong>Domain: </strong>
                    <span>{configResponse.config.domain}</span>
                  </p>
                </>
              )}
            </div>
          ) : (
            <p>No API response data available</p>
          )}
        </section>
        
        <section className="border rounded-lg p-4 bg-white shadow">
          <h2 className="text-xl font-semibold mb-3">Manual Testing</h2>
          <div className="mb-3">
            <label className="block text-sm mb-1">
              Test with a different Site Key:
            </label>
            <input
              type="text"
              value={manualSiteKey}
              onChange={(e) => setManualSiteKey(e.target.value)}
              placeholder="Enter reCAPTCHA site key"
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <button
            onClick={handleManualTest}
            disabled={!manualSiteKey}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:bg-gray-400 mr-2"
          >
            Test Manual Key
          </button>
        </section>
      </div>
      
      {testResult && (
        <section className="border rounded-lg p-4 bg-white shadow mt-6">
          <h2 className="text-xl font-semibold mb-3">Test Result</h2>
          <div className={`p-3 rounded ${
            testResult.status === 'success' ? 'bg-green-100 text-green-800' :
            testResult.status === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            <p className="font-semibold">{testResult.message}</p>
            {testResult.token && (
              <p className="mt-1">Token: {testResult.token}</p>
            )}
            {testResult.error && (
              <p className="mt-1">Error: {testResult.error}</p>
            )}
          </div>
        </section>
      )}
      
      <section className="border rounded-lg p-4 bg-white shadow mt-6">
        <h2 className="text-xl font-semibold mb-3">Debug Tools</h2>
        <div className="flex gap-3">
          <button
            onClick={enableDebugLogging}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded"
          >
            Toggle Debug Logging
          </button>
          <button
            onClick={reloadEnvVars}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Reload Environment Variables
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Refresh Page
          </button>
        </div>
      </section>
      
      <div className="mt-8 text-sm text-gray-600">
        <p>Note: This page is for debugging purposes only. Remove it before deploying to production.</p>
      </div>
    </div>
  );
} 