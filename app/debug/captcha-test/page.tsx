'use client';

import { useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';

export default function CaptchaTestPage() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string>('');
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get the site key from the environment variable
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    setSiteKey(envSiteKey || '6LdlnC8pAAAAAKgGryyYW0H5OUAhzs_WbYYHHUL5');
    
    // Fetch the configuration status
    fetchConfigStatus();
  }, []);

  const fetchConfigStatus = async () => {
    try {
      const response = await fetch('/api/debug/captcha-config');
      const data = await response.json();
      setConfigStatus(data);
    } catch (error) {
      console.error('Failed to fetch config status:', error);
      setConfigStatus({ error: 'Failed to fetch configuration status' });
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
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

  const tryHardcodedSiteKey = () => {
    setSiteKey('6LdlnC8pAAAAAKgGryyYW0H5OUAhzs_WbYYHHUL5');
  };

  const tryEnvSiteKey = () => {
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (envSiteKey) {
      setSiteKey(envSiteKey);
    } else {
      setVerifyResult({ success: false, message: 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined in the environment' });
    }
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
              Use this page to test if reCAPTCHA is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Configuration Status</h3>
                {configStatus ? (
                  <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md overflow-auto">
                    {JSON.stringify(configStatus, null, 2)}
                  </pre>
                ) : (
                  <p>Loading configuration status...</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Current Site Key</h3>
                <p className="font-mono text-sm">{siteKey ? `${siteKey.substring(0, 10)}...` : 'Not set'}</p>
                <div className="flex gap-2">
                  <Button onClick={tryEnvSiteKey} variant="outline">
                    Use Environment Variable
                  </Button>
                  <Button onClick={tryHardcodedSiteKey} variant="outline">
                    Use Hardcoded Key
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Test reCAPTCHA</h3>
                
                <div className="flex justify-center my-4">
                  {siteKey && (
                    <ReCAPTCHA
                      sitekey={siteKey}
                      onChange={handleCaptchaChange}
                    />
                  )}
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    onClick={handleVerifyCaptcha} 
                    disabled={!captchaToken || isLoading}
                    className="w-full max-w-xs"
                  >
                    {isLoading ? 'Verifying...' : 'Verify CAPTCHA'}
                  </Button>
                </div>

                {verifyResult && (
                  <div className={`p-4 rounded-md ${verifyResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <h4 className={`font-medium ${verifyResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {verifyResult.success ? 'Verification Successful' : 'Verification Failed'}
                    </h4>
                    <p>{verifyResult.message}</p>
                    {verifyResult.details && (
                      <pre className="mt-2 text-xs overflow-auto">
                        {JSON.stringify(verifyResult.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
} 