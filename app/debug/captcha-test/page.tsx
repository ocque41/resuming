'use client';

import { useEffect, useState } from 'react';
import ReCAPTCHAWrapper from '@/components/ui/recaptcha';
import { ReCaptchaV3, useReCaptchaV3 } from '@/components/ui/recaptcha-v3';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertTriangle, RefreshCw, Globe, ArrowRight, ExternalLink } from 'lucide-react';

export default function CaptchaTestPage() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string>('');
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customSiteKey, setCustomSiteKey] = useState<string>('');
  const [activeTab, setActiveTab] = useState('test');
  const [envVars, setEnvVars] = useState<any>(null);
  const [domainInfo, setDomainInfo] = useState<any>(null);
  const [isDomainCheckLoading, setIsDomainCheckLoading] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<any>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  
  // State for reCAPTCHA v3
  const [v3Action, setV3Action] = useState<string>('homepage');
  const [v3Token, setV3Token] = useState<string | null>(null);
  const [v3VerifyResult, setV3VerifyResult] = useState<any>(null);
  const [isV3Loading, setIsV3Loading] = useState(false);
  
  // Use the reCAPTCHA v3 hook
  const { executeReCaptcha, token: hookToken, error: recaptchaError, loading: recaptchaLoading } = useReCaptchaV3();

  useEffect(() => {
    // Get the site key from the environment variable
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    setSiteKey(envSiteKey || '6LdlnC8pAAAAAKgGryyYW0H5OUAhzs_WbYYHHUL5');
    
    // Fetch configuration status
    fetchConfigStatus();
    
    // Fetch environment variables
    fetchEnvVars();
  }, []);

  const fetchConfigStatus = async () => {
    try {
      setConfigStatus(null);
      const response = await fetch('/api/debug/captcha-config');
      const data = await response.json();
      setConfigStatus(data);
    } catch (error) {
      console.error('Failed to fetch config status:', error);
      setConfigStatus({ error: 'Failed to fetch configuration status' });
    }
  };

  const fetchEnvVars = async () => {
    try {
      const response = await fetch('/api/debug/captcha-client-test');
      const data = await response.json();
      setEnvVars(data);
    } catch (error) {
      console.error('Failed to fetch environment variables:', error);
      setEnvVars({ error: 'Failed to fetch environment variables' });
    }
  };

  const fetchDomainInfo = async () => {
    try {
      setIsDomainCheckLoading(true);
      const response = await fetch('/api/debug/captcha-domain-check');
      const data = await response.json();
      setDomainInfo(data);
    } catch (error) {
      console.error('Failed to fetch domain info:', error);
      setDomainInfo({ error: 'Failed to fetch domain information' });
    } finally {
      setIsDomainCheckLoading(false);
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
    setVerifyResult(null);
  };

  const handleVerifyCaptcha = async () => {
    if (!captchaToken) {
      setVerifyResult({ success: false, message: 'Please complete the CAPTCHA first' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/debug/captcha-client-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captchaToken }),
      });
      
      const data = await response.json();
      setVerifyResult(data);
    } catch (error) {
      console.error('Failed to verify CAPTCHA:', error);
      setVerifyResult({ success: false, message: 'Error verifying CAPTCHA' });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function for handling reCAPTCHA v3 execution
  const handleExecuteV3 = async () => {
    setIsV3Loading(true);
    setV3Token(null);
    setV3VerifyResult(null);
    
    try {
      const token = await executeReCaptcha(v3Action);
      setV3Token(token);
      
      if (token) {
        // Verify the token
        const response = await fetch('/api/debug/captcha-client-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ captchaToken: token }),
        });
        
        const data = await response.json();
        setV3VerifyResult(data);
      }
    } catch (error) {
      console.error('Failed to execute or verify reCAPTCHA v3:', error);
      setV3VerifyResult({ 
        success: false, 
        message: `Error with reCAPTCHA v3: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsV3Loading(false);
    }
  };
  
  // Handle token from reCAPTCHA v3 component
  const handleV3TokenGenerated = (token: string) => {
    setV3Token(token);
    
    // Automatically verify the token
    verifyV3Token(token);
  };
  
  // Verify a reCAPTCHA v3 token
  const verifyV3Token = async (token: string) => {
    setIsV3Loading(true);
    
    try {
      const response = await fetch('/api/debug/captcha-client-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captchaToken: token }),
      });
      
      const data = await response.json();
      setV3VerifyResult(data);
    } catch (error) {
      console.error('Failed to verify reCAPTCHA v3:', error);
      setV3VerifyResult({ 
        success: false, 
        message: `Error verifying reCAPTCHA v3: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setIsV3Loading(false);
    }
  };

  const tryHardcodedSiteKey = () => {
    setSiteKey('6LdlnC8pAAAAAKgGryyYW0H5OUAhzs_WbYYHHUL5');
    setCaptchaToken(null);
    setVerifyResult(null);
  };

  const tryEnvSiteKey = () => {
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (envSiteKey) {
      setSiteKey(envSiteKey);
      setCaptchaToken(null);
      setVerifyResult(null);
    } else {
      setVerifyResult({ success: false, message: 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined in the environment' });
    }
  };

  const tryCustomSiteKey = async () => {
    if (!customSiteKey || customSiteKey.length < 10) {
      setVerifyResult({ success: false, message: 'Please enter a valid site key' });
      return;
    }

    // First test the key format
    setIsTestingKey(true);
    try {
      const response = await fetch('/api/debug/captcha-test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteKey: customSiteKey }),
      });
      
      const data = await response.json();
      setKeyTestResult(data);
      
      // If the key is valid format, use it
      if (data.valid || data.isTestKey) {
        setSiteKey(customSiteKey);
        setCaptchaToken(null);
        setVerifyResult(null);
      }
    } catch (error) {
      console.error('Failed to test site key:', error);
      setKeyTestResult({ 
        valid: false, 
        error: 'Error testing key',
        message: 'Could not test the site key due to a server error.' 
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const refreshData = () => {
    fetchConfigStatus();
    fetchEnvVars();
    setCaptchaToken(null);
    setVerifyResult(null);
  };

  return (
    <div className="container max-w-4xl py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>reCAPTCHA Debug Page</CardTitle>
            <CardDescription>
              Use this page to test and troubleshoot reCAPTCHA integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="test">Test reCAPTCHA v2</TabsTrigger>
                <TabsTrigger value="v3test">Test reCAPTCHA v3</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="env">Environment</TabsTrigger>
                <TabsTrigger value="domain">Domain Check</TabsTrigger>
                <TabsTrigger value="troubleshoot">Troubleshooting</TabsTrigger>
              </TabsList>
              
              <TabsContent value="test" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">reCAPTCHA v2 Test</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshData}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <div className="mb-4">
                    <p className="font-mono text-sm mb-2">Current Site Key: {siteKey ? `${siteKey.substring(0, 6)}...${siteKey.substring(siteKey.length - 4)}` : 'Not set'}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={tryEnvSiteKey} variant="outline" size="sm">
                        Use Environment Variable
                      </Button>
                      <Button onClick={tryHardcodedSiteKey} variant="outline" size="sm">
                        Use Hardcoded Key
                      </Button>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="flex justify-center my-4">
                    <ReCAPTCHAWrapper
                      onChange={handleCaptchaChange}
                      theme="light"
                    />
                  </div>
                </div>
                
                <div className="flex justify-center mt-4">
                  <Button 
                    onClick={handleVerifyCaptcha} 
                    disabled={!captchaToken || isLoading}
                    className="w-full max-w-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify CAPTCHA'
                    )}
                  </Button>
                </div>

                {verifyResult && (
                  <div className={`p-4 rounded-md ${verifyResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-start">
                      {verifyResult.success ? (
                        <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h4 className={`font-medium ${verifyResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {verifyResult.success ? 'Verification Successful' : 'Verification Failed'}
                        </h4>
                        <p>{verifyResult.message}</p>
                        {verifyResult.details && (
                          <pre className="mt-2 text-xs overflow-auto p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                            {JSON.stringify(verifyResult.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="config" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Server Configuration</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchConfigStatus}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                
                {configStatus ? (
                  <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md overflow-auto">
                    {JSON.stringify(configStatus, null, 2)}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-800 rounded-md">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <p>Loading configuration status...</p>
                  </div>
                )}
                
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Custom Site Key</h3>
                    <div className="flex gap-2">
                      <Input
                        value={customSiteKey}
                        onChange={(e) => setCustomSiteKey(e.target.value)}
                        placeholder="Enter custom site key..."
                        className="font-mono"
                      />
                      <Button 
                        onClick={tryCustomSiteKey} 
                        variant="outline"
                        disabled={isTestingKey}
                      >
                        {isTestingKey ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          'Test & Use Key'
                        )}
                      </Button>
                    </div>
                    
                    {keyTestResult && (
                      <div className={`mt-4 p-4 rounded-md ${keyTestResult.valid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                        <div className="flex items-start">
                          {keyTestResult.valid ? (
                            <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <h4 className={`font-medium ${keyTestResult.valid ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                              {keyTestResult.valid ? 'Key Format Appears Valid' : 'Key Format Issue'}
                            </h4>
                            <p className="text-sm">{keyTestResult.message}</p>
                            
                            {keyTestResult.isTestKey && (
                              <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded text-xs">
                                <strong>Warning:</strong> {keyTestResult.warning}
                              </div>
                            )}
                            
                            {keyTestResult.isEnvKey && (
                              <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-xs">
                                <strong>Note:</strong> This is the same key as your environment variable.
                              </div>
                            )}
                            
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="font-medium">Key Length:</span> {keyTestResult.keyLength || 0}
                              </div>
                              <div>
                                <span className="font-medium">Expected:</span> {keyTestResult.expectedLength || 40}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-medium">Google Test Keys</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      These are official Google test keys that always pass verification regardless of domain.
                      Use them only for development and testing.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                        <h4 className="font-medium mb-2">reCAPTCHA v2 Test Keys</h4>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs mb-1 font-medium">Site Key:</p>
                            <code className="text-xs font-mono bg-white dark:bg-slate-700 p-1 rounded block">
                              6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
                            </code>
                          </div>
                          <div>
                            <p className="text-xs mb-1 font-medium">Secret Key:</p>
                            <code className="text-xs font-mono bg-white dark:bg-slate-700 p-1 rounded block">
                              6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
                            </code>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full mt-2" 
                            onClick={() => {
                              setCustomSiteKey('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI');
                              tryCustomSiteKey();
                            }}
                          >
                            Use Test Keys
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <h4 className="font-medium mb-2">Debugging Tips</h4>
                        <ul className="text-xs space-y-2 list-disc list-inside">
                          <li>Test keys work on all domains, including localhost</li>
                          <li>Test keys always pass verification</li>
                          <li>Use test keys to isolate configuration vs. key issues</li>
                          <li>If test keys work but your keys don't, check domain configuration</li>
                          <li>Don't use test keys in production environments</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="env" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Environment Variables</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchEnvVars}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                
                {envVars ? (
                  <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md overflow-auto">
                    {JSON.stringify(envVars, null, 2)}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-800 rounded-md">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <p>Loading environment variables...</p>
                  </div>
                )}
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium mb-2">Client-Side Environment</h4>
                  <div className="space-y-2">
                    <p><strong>process.env.NODE_ENV:</strong> {process.env.NODE_ENV || 'Not set'}</p>
                    <p><strong>RECAPTCHA_SITE_KEY available:</strong> {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? 'Yes' : 'No'}</p>
                    <p><strong>window object available:</strong> {typeof window !== 'undefined' ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="domain" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Domain Configuration Check</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchDomainInfo}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Check Now
                  </Button>
                </div>
                
                {!domainInfo && !isDomainCheckLoading && (
                  <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-md text-center">
                    <Globe className="h-8 w-8 mx-auto mb-3 text-slate-500" />
                    <p className="mb-4">Check your domain configuration for reCAPTCHA compatibility</p>
                    <Button onClick={fetchDomainInfo}>
                      Run Domain Check
                    </Button>
                  </div>
                )}
                
                {isDomainCheckLoading && (
                  <div className="flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-800 rounded-md">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <p>Checking domain configuration...</p>
                  </div>
                )}
                
                {domainInfo && !isDomainCheckLoading && (
                  <>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                      <h4 className="font-medium mb-3">Domain Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-white dark:bg-slate-700 rounded shadow-sm">
                          <p className="text-sm font-medium mb-1">Current Domain</p>
                          <p className="text-sm font-mono">{domainInfo.domains?.current || 'Unknown'}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-700 rounded shadow-sm">
                          <p className="text-sm font-medium mb-1">reCAPTCHA Status</p>
                          <p className="text-sm">{domainInfo.recaptcha?.status || 'Unknown'}</p>
                        </div>
                      </div>
                      
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <ul className="list-disc list-inside space-y-1 mb-4">
                        {domainInfo.domains?.recommendations?.map((rec: string, i: number) => (
                          <li key={i} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-yellow-700 dark:text-yellow-300">Important</h4>
                            <p className="text-sm">
                              Make sure your reCAPTCHA key is configured for {domainInfo.domains?.current || 'your domain'}.
                              Visit the Google reCAPTCHA admin console to check your domain settings.
                            </p>
                            <a 
                              href="https://www.google.com/recaptcha/admin" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 mt-2"
                            >
                              Go to reCAPTCHA Admin
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <details className="mt-4">
                      <summary className="cursor-pointer font-medium text-sm">View Raw Domain Check Response</summary>
                      <pre className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-md overflow-auto text-xs">
                        {JSON.stringify(domainInfo, null, 2)}
                      </pre>
                    </details>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="troubleshoot" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">reCAPTCHA Troubleshooting Guide</h3>
                </div>
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium mb-4">Common Issues & Solutions</h4>
                  
                  <div className="space-y-6">
                    <div className="p-4 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-md">
                      <h5 className="font-medium text-red-700 dark:text-red-300 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        "Invalid site key" Error
                      </h5>
                      <p className="text-sm mt-1 mb-2">
                        This usually indicates a problem with your reCAPTCHA configuration or domain settings.
                      </p>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        <li>Verify that you're using the correct site key</li>
                        <li>Check that your domain is added to the allowed domains in the reCAPTCHA admin console</li>
                        <li>For localhost testing, ensure localhost is added as an allowed domain</li>
                        <li>Try using Google's test keys to verify if it's a key issue or implementation issue</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 border border-yellow-200 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/10 rounded-md">
                      <h5 className="font-medium text-yellow-700 dark:text-yellow-300 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        CAPTCHA Not Displaying
                      </h5>
                      <p className="text-sm mt-1 mb-2">
                        If the CAPTCHA widget doesn't appear at all:
                      </p>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        <li>Check browser console for JavaScript errors</li>
                        <li>Verify that the reCAPTCHA JavaScript is loaded correctly</li>
                        <li>Ensure you're not in a content security policy restricted environment</li>
                        <li>Verify that your browser is not blocking third-party scripts or cookies</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10 rounded-md">
                      <h5 className="font-medium text-blue-700 dark:text-blue-300 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Verification Always Fails
                      </h5>
                      <p className="text-sm mt-1 mb-2">
                        If verification fails even when the CAPTCHA is completed correctly:
                      </p>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        <li>Check that your secret key is correct in the server environment</li>
                        <li>Verify that the token is being passed correctly to your verification endpoint</li>
                        <li>Check for network issues or timeouts when calling the Google verification API</li>
                        <li>Verify that your server's time is synchronized correctly (NTP)</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <h4 className="font-medium mb-4">Debugging Steps</h4>
                  
                  <ol className="space-y-3 list-decimal list-inside text-sm">
                    <li>
                      <span className="font-medium">Try Google's Test Keys</span>
                      <p className="pl-6 text-xs mt-1">
                        Use the test keys to see if your implementation works correctly with known-good keys.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium">Check Domain Configuration</span>
                      <p className="pl-6 text-xs mt-1">
                        Verify that your current domain is allowed in the reCAPTCHA admin console.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium">Examine Browser Console</span>
                      <p className="pl-6 text-xs mt-1">
                        Look for JavaScript errors or warnings related to reCAPTCHA.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium">Check Network Requests</span>
                      <p className="pl-6 text-xs mt-1">
                        Inspect the browser's network tab to see if the reCAPTCHA API calls are succeeding.
                      </p>
                    </li>
                    <li>
                      <span className="font-medium">Verify Server Integration</span>
                      <p className="pl-6 text-xs mt-1">
                        Ensure your server is correctly calling the Google verification API with the right parameters.
                      </p>
                    </li>
                  </ol>
                </div>
                
                <div className="p-4 border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-900/10 rounded-md">
                  <h4 className="font-medium text-green-700 dark:text-green-300 flex items-center mb-3">
                    <Check className="h-4 w-4 mr-1" />
                    Quick Checklist
                  </h4>
                  
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <input type="checkbox" className="mt-1 mr-2" />
                      <span>Correct site key is being used</span>
                    </li>
                    <li className="flex items-start">
                      <input type="checkbox" className="mt-1 mr-2" />
                      <span>Current domain is in the allowed domains list</span>
                    </li>
                    <li className="flex items-start">
                      <input type="checkbox" className="mt-1 mr-2" />
                      <span>Secret key is correctly set in the server environment</span>
                    </li>
                    <li className="flex items-start">
                      <input type="checkbox" className="mt-1 mr-2" />
                      <span>No JavaScript errors in the browser console</span>
                    </li>
                    <li className="flex items-start">
                      <input type="checkbox" className="mt-1 mr-2" />
                      <span>Server is correctly verifying the token with Google</span>
                    </li>
                  </ul>
                </div>
                
                <div className="text-center">
                  <a 
                    href="https://developers.google.com/recaptcha/docs/verify" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    Google reCAPTCHA Documentation
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              </TabsContent>

              <TabsContent value="v3test" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">reCAPTCHA v3 Test</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshData}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                  <p className="mb-4 text-sm">
                    reCAPTCHA v3 returns a score for each request without user friction. 
                    The score (1.0 is very likely a good interaction, 0.0 is very likely a bot) 
                    can be used to determine appropriate action.
                  </p>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Select an action:</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={() => setV3Action('homepage')} 
                        variant={v3Action === 'homepage' ? 'default' : 'outline'}
                        size="sm"
                      >
                        homepage
                      </Button>
                      <Button 
                        onClick={() => setV3Action('login')} 
                        variant={v3Action === 'login' ? 'default' : 'outline'}
                        size="sm"
                      >
                        login
                      </Button>
                      <Button 
                        onClick={() => setV3Action('signup')} 
                        variant={v3Action === 'signup' ? 'default' : 'outline'} 
                        size="sm"
                      >
                        signup
                      </Button>
                      <Button 
                        onClick={() => setV3Action('submit')} 
                        variant={v3Action === 'submit' ? 'default' : 'outline'} 
                        size="sm"
                      >
                        submit
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mb-4 bg-slate-200 dark:bg-slate-700 p-3 rounded-md">
                    <p className="font-mono text-xs mb-2">
                      Current Action: <span className="font-bold">{v3Action}</span>
                    </p>
                    <Button 
                      onClick={handleExecuteV3} 
                      disabled={isV3Loading || recaptchaLoading}
                      size="sm"
                    >
                      {isV3Loading || recaptchaLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        'Execute reCAPTCHA v3'
                      )}
                    </Button>
                    <p className="text-xs mt-2 text-slate-600 dark:text-slate-400">
                      This will use the useReCaptchaV3 hook to execute reCAPTCHA v3 without a visible challenge.
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Try the ReCaptchaV3 component:</p>
                    <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-md">
                      <p className="text-xs mb-2">
                        This component will automatically execute reCAPTCHA v3 with the specified action:
                      </p>
                      <ReCaptchaV3 
                        action={v3Action}
                        onVerify={handleV3TokenGenerated}
                        className="min-h-[30px]"
                      />
                    </div>
                  </div>
                </div>
                
                {v3Token && (
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md">
                    <h4 className="font-medium mb-2">reCAPTCHA v3 Token:</h4>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-md">
                      <p className="text-xs font-mono break-all">{v3Token}</p>
                    </div>
                  </div>
                )}
                
                {v3VerifyResult && (
                  <div className={`p-4 rounded-md ${v3VerifyResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-start">
                      {v3VerifyResult.success ? (
                        <Check className="h-5 w-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h4 className={`font-medium ${v3VerifyResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {v3VerifyResult.success ? 'Verification Successful' : 'Verification Failed'}
                        </h4>
                        <p>{v3VerifyResult.message}</p>
                        
                        {v3VerifyResult.score !== undefined && (
                          <div className="mt-2 p-2 bg-slate-200 dark:bg-slate-700 rounded-md">
                            <p className="text-sm font-medium">Score: {v3VerifyResult.score.toFixed(2)}</p>
                            <p className="text-xs mt-1">
                              {v3VerifyResult.score > 0.7 
                                ? 'High score: Very likely legitimate user'
                                : v3VerifyResult.score > 0.5
                                  ? 'Medium score: Likely legitimate user'
                                  : 'Low score: Possibly bot or suspicious activity'}
                            </p>
                          </div>
                        )}
                        
                        {v3VerifyResult.details && (
                          <pre className="mt-2 text-xs overflow-auto p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                            {JSON.stringify(v3VerifyResult.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
} 