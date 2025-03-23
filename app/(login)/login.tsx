"use client";

import Link from "next/link";
import { useActionState } from "@/lib/useActionState";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "lucide-react";
import Image from "next/image";
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import { useReCaptcha } from "@/components/ui/recaptcha-v3";
import ReCaptchaFeedback from "@/components/ui/recaptcha-feedback";
import { useReCaptchaContext } from "@/lib/recaptcha/recaptcha-context";
import ReCaptchaBadge from "@/components/ui/recaptcha-badge";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { signIn, signUp } from "./actions";
import { ActionState } from "@/lib/auth/middleware";

// Import our reCAPTCHA utilities
import { RECAPTCHA_ACTIONS, getMinScoreForAction, getErrorMessageForAction } from "@/lib/recaptcha/actions";
import { 
  isRecaptchaConfigured, 
  getRecaptchaConfigStatus, 
  isDevelopmentDomain,
  isProductionDomain,
  PRODUCTION_DOMAINS 
} from "@/lib/recaptcha/domain-check";

// Create a global window object to store environment variables
// This helps with client-side environment variable access
const setupEnv = () => {
  if (typeof window !== 'undefined') {
    if (!window.__env) {
      window.__env = {};
    }
    
    // Set reCAPTCHA site key if available
    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    }
    
    // Attempt to get from URL parameters (useful for testing)
    const urlParams = new URLSearchParams(window.location.search);
    const urlSiteKey = urlParams.get('recaptchaKey');
    if (urlSiteKey) {
      window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = urlSiteKey;
    }
    
    // Store domain information
    window.__env.domain = window.location.hostname;
    window.__env.isProductionDomain = PRODUCTION_DOMAINS.includes(window.location.hostname);
    window.__env.isDevelopmentDomain = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local') ||
      window.location.hostname.endsWith('.test');
  }
};

// Enhanced debugging for reCAPTCHA
if (typeof window !== 'undefined') {
  setupEnv();
  
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log("Login component - Environment:", process.env.NODE_ENV);
    console.log("Login component - RECAPTCHA_SITE_KEY available:", !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
    console.log("Login component - window.__env available:", !!window.__env);
    console.log("Login component - Domain:", window.location.hostname);
    console.log("Login component - Is Production Domain:", window.__env?.isProductionDomain);
    
    if (window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      console.log("Login component - window.__env.RECAPTCHA_SITE_KEY available:", true);
      console.log("Login component - window.__env.RECAPTCHA_SITE_KEY length:", window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length);
      console.log("Login component - window.__env.RECAPTCHA_SITE_KEY first 5 chars:", window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 5));
    } else if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      console.log("Login component - RECAPTCHA_SITE_KEY length:", process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length);
      console.log("Login component - RECAPTCHA_SITE_KEY first 5 chars:", process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 5));
    } else {
      console.warn("Login component - No reCAPTCHA site key found in environment variables");
    }
  }
}

// Add to window global interface
declare global {
  interface Window {
    __env?: {
      [key: string]: any;
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY?: string;
      domain?: string;
      isProductionDomain?: boolean;
      isDevelopmentDomain?: boolean;
      usingTestKey?: boolean;
    };
  }
}

// Type for auth mode
type AuthMode = "signin" | "signup";

/**
 * Create the appropriate action function based on the authentication mode
 * This ensures the return type is compatible with ActionState
 */
const createAction = (mode: AuthMode) => (data: FormData) => {
  // Convert the response to ensure it's compatible with ActionState
  const convertToActionState = (response: any): ActionState => {
    // If the response has 'success' as boolean, convert it to string
    if (response && typeof response.success === 'boolean') {
      return {
        ...response,
        success: response.success === true ? "true" : "",
        message: response.message || ""
      };
    }
    return response || { error: "", email: "", password: "" };
  };

  if (mode === "signin") {
    return signIn({ error: "", email: "", password: "" }, data)
      .then(res => convertToActionState(res));
  } else {
    return signUp({ error: "", email: "", password: "" }, data)
      .then(res => convertToActionState(res));
  }
};

/**
 * Determine if reCAPTCHA verification should be skipped based on environment
 */
function shouldSkipVerification(mode: AuthMode): boolean {
  // For sign-in, we typically have less strict requirements
  if (mode === "signin") {
    return true; // We can optionally enable verification for suspicious logins
  }
  
  // Get environment information
  const isDev = process.env.NODE_ENV === 'development';
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isVercelPreview = typeof window !== 'undefined' && 
    window.location.hostname.includes('vercel.app');
  const usingTestKeys = typeof window !== 'undefined' && window.__env?.usingTestKey === true;
  const skipRecaptcha = process.env.SKIP_RECAPTCHA === 'true';
  
  // Skip in development with SKIP_RECAPTCHA flag
  if (isDev && skipRecaptcha) {
    console.log("Skipping reCAPTCHA: SKIP_RECAPTCHA flag is set");
    return true;
  }
  
  // Skip for localhost in development
  if (isDev && isLocalhost) {
    console.log("Skipping reCAPTCHA: localhost in development");
    return true;
  }
  
  // Skip for Vercel preview deployments
  if (isVercelPreview) {
    console.log("Skipping reCAPTCHA: Vercel preview deployment");
    return true;
  }
  
  return false;
}

/**
 * Handle skipping verification based on mode and environment
 */
function handleSkipVerification(mode: AuthMode, formData: FormData, formAction: (formData: FormData) => void) {
  if (mode === "signin") {
    console.log("Signin: Verification not required");
    formAction(formData);
    return true;
  }
  
  const shouldSkip = shouldSkipVerification(mode);
  
  if (shouldSkip) {
    console.log(`Skipping verification for ${mode}`);
    formAction(formData);
    return true;
  }
  
  return false;
}

function AuthForm({ mode }: { mode: AuthMode }) {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect");
  const priceId = searchParams?.get("priceId");
  const inviteId = searchParams?.get("inviteId");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAction(mode),
    { error: "", email: "", password: "" }
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaAttempts, setCaptchaAttempts] = useState(0);
  const [submitAllowed, setSubmitAllowed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Use our ReCaptchaContext instead of direct hook
  const {
    token,
    isLoading: recaptchaLoading,
    error: recaptchaError,
    isConfigured: recaptchaConfigured,
    verificationStatus,
    verificationMessage,
    verificationScore,
    executeVerification,
    resetVerification,
    setCustomMessage,
    skipVerification
  } = useReCaptchaContext();

  // Effect to handle reCAPTCHA errors
  useEffect(() => {
    if (recaptchaError) {
      console.error('reCAPTCHA error:', recaptchaError);
      setCustomMessage(recaptchaError.message, 'error');
    }
  }, [recaptchaError, setCustomMessage]);

  // If token is loaded after user started submitting, continue submission
  useEffect(() => {
    if (isSubmitting && token && formRef.current) {
      console.log("Token received while submitting, continuing submission");
      const formData = new FormData(formRef.current);
      
      // Only append captcha token for signup mode
      if (mode === "signup") {
        formData.append("captchaToken", token);
      }
      
      formAction(formData);
      setIsSubmitting(false);
    }
  }, [token, isSubmitting, formAction, mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Get form data
      const formData = new FormData(event.currentTarget);
      
      // Check if we should skip verification
      if (handleSkipVerification(mode, formData, formAction)) {
        setIsSubmitting(false);
        return;
      }
      
      // If we get here, we need to verify (mostly for signup)
      console.log(`${mode} form submission started - requires verification`);
      resetVerification();
      setCustomMessage("Verifying your request...", 'loading');
      
      // Execute reCAPTCHA verification
      const captchaAction = mode === "signup" ? RECAPTCHA_ACTIONS.SIGNUP : RECAPTCHA_ACTIONS.LOGIN;
      
      try {
        // Attempt to get a verification token
        const captchaToken = await executeVerification(captchaAction);
        
        if (captchaToken) {
          // Success! Submit the form with the token
          console.log(`reCAPTCHA verification successful for ${mode}`);
          setCustomMessage("Verification successful", 'success');
          
          // Create form data and add token
          const formData = new FormData(event.currentTarget);
          formData.append("captchaToken", captchaToken);
          
          // Submit the form with the token
          formAction(formData);
        } else {
          // No token, but no error either (unusual)
          console.warn(`reCAPTCHA returned no token for ${mode}`);
          setCustomMessage("Verification incomplete. Please try again.", 'warning');
          setIsSubmitting(false);
        }
      } catch (error) {
        console.error(`reCAPTCHA verification error for ${mode}:`, error);
        
        // Handle domain-specific errors
        const isProductionSite = typeof window !== 'undefined' && 
          PRODUCTION_DOMAINS.includes(window.location.hostname);
        
        const errorMessage = error instanceof Error ? error.message : "Verification failed";
        
        if (isProductionSite) {
          // On production site, this should not happen
          setCustomMessage(
            `Unexpected verification error on ${window.location.hostname}. Please try again or contact support.`, 
            'error'
          );
          
          // For production domains, log the error with more details
          console.error("Production domain verification error:", {
            domain: window.location.hostname,
            mode,
            error: errorMessage,
            time: new Date().toISOString()
          });
        } else {
          // On development or other domains, show more details
          setCustomMessage(errorMessage, 'error');
          
          // After a short delay, offer to continue without verification on non-prod
          if (mode === "signup" && process.env.NODE_ENV !== 'production') {
            setTimeout(() => {
              setCustomMessage(
                "Continue without verification in development mode?", 
                'warning'
              );
              setSubmitAllowed(true);
            }, 2000);
          }
        }
        
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      const errorMsg = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      setCustomMessage(errorMsg, 'error');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form
        ref={formRef}
        className="space-y-6"
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="redirect" value={redirect || ""} />
        <input type="hidden" name="priceId" value={priceId || ""} />
        <input type="hidden" name="inviteId" value={inviteId || ""} />
        <div>
          <Label htmlFor="email" className="block text-sm font-medium text-white">
            Email
          </Label>
          <div className="mt-1">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              required
              maxLength={50}
              className="appearance-none rounded-full block w-full px-3 py-2 border border-[#B4916C]/30 placeholder-[#B4916C] text-white bg-[#9E7C57] focus:outline-none focus:ring-[#B4916C] focus:border-[#B4916C] sm:text-sm"
              placeholder="Enter your email"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password" className="block text-sm font-medium text-white">
            Password
          </Label>
          <div className="mt-1">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              defaultValue={state.password}
              required
              minLength={8}
              maxLength={100}
              className="appearance-none rounded-full block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-white bg-[#9E7C57] focus:outline-none focus:ring-[#B4916C] focus:border-[#B4916C] sm:text-sm"
              placeholder="Enter your password"
            />
          </div>
        </div>

        {/* Only show reCAPTCHA feedback for signup or if verification is active */}
        {(mode === "signup" || verificationStatus !== 'idle') && (
          <div className="flex flex-col items-center">
            {/* Use ReCaptchaFeedback with our context state */}
            <div className="w-full my-2">
              <ReCaptchaFeedback 
                status={verificationStatus}
                message={verificationMessage}
                score={verificationScore}
                action={mode === "signup" ? RECAPTCHA_ACTIONS.SIGNUP : RECAPTCHA_ACTIONS.LOGIN}
                onRetry={() => {
                  resetVerification();
                  setCaptchaAttempts(0);
                  setIsSubmitting(false);
                  executeVerification(mode === "signup" ? RECAPTCHA_ACTIONS.SIGNUP : RECAPTCHA_ACTIONS.LOGIN);
                }}
                onSkip={() => {
                  if (formRef.current) {
                    // Skip verification and continue with form submission
                    console.log(`Skipping verification for ${mode} form submission`);
                    setCustomMessage(
                      "Continuing without verification. This may reduce security.", 
                      "warning"
                    );
                    
                    // Create form data
                    const formData = new FormData(formRef.current);
                    formAction(formData);
                  }
                }}
              />
            </div>
            
            {mode === "signup" && (
              <div className="text-sm text-[#F9F6EE] mt-4 text-center max-w-xs">
                By signing up you are agreeing to our{" "}
                <a 
                  href="https://chromad.vercel.app/docs/products/resuming/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#F9F6EE] underline hover:text-[#B4916C] transition-colors"
                >
                  Terms of Service and Policies
                </a>
              </div>
            )}
          </div>
        )}

        {state?.error && <div className="text-red-500 text-sm">{state.error}</div>}

        <div>
          <Button
            type="submit"
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-[#B4916C] hover:bg-[#B4916C]/75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
            disabled={pending || isSubmitting || (recaptchaLoading && mode === "signup" && recaptchaConfigured && !submitAllowed)}
          >
            {pending || isSubmitting ? (
              <>
                <Loader className="animate-spin mr-2 h-4 w-4" />
                {isSubmitting ? "Verifying..." : "Loading..."}
              </>
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Sign up"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}

export function Login({ mode = "signin" }: { mode?: AuthMode }) {
  const router = useRouter();

  // Debug log on component mount
  useEffect(() => {
    console.log("Login mode:", mode);
    // Setup environment variables
    setupEnv();
  }, [mode]);

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
        </div>
        <Card className="sm:max-w-md w-full">
          <CardHeader className="p-6">
            <CardTitle className="text-3xl font-bold">
              {mode === "signin" ? "Sign in to your account" : "Create your account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6">
            {/* Tabs replaced by link-based navigation */}
            <div className="flex w-full justify-center space-x-2 mb-4">
              <Link
                href="/sign-in"
                className={`w-full text-center py-2 px-4 rounded-md transition-colors duration-300 hover:bg-[#B4916C]/75 ${
                  mode === "signin" ? "bg-[#B4916C]/50" : ""
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className={`w-full text-center py-2 px-4 rounded-md transition-colors duration-300 hover:bg-[#B4916C]/75 ${
                  mode === "signup" ? "bg-[#B4916C]/50" : ""
                }`}
              >
                Sign Up
              </Link>
            </div>
            <div>
              <AuthForm mode={mode} />
            </div>
          </CardContent>
          <CardFooter className="p-6">
            <div className="text-sm text-white">
              {mode === "signin" ? "New to our platform? " : "Already have an account? "}
              <Link
                href={mode === "signin" ? "/sign-up" : "/sign-in"}
                className="text-[#B4916C] hover:underline"
              >
                {mode === "signin" ? "Create an account" : "Sign in to your account"}
              </Link>
            </div>
          </CardFooter>
        </Card>
        
        {/* Use the ReCaptchaBadge component instead of hardcoded attribution */}
        <ReCaptchaBadge 
          position="bottom-right"
          variant="dark"
          size="small"
          minimalist
        />
      </div>
    </div>
  );
}
