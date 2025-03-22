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

// Import our new reCAPTCHA utilities
import { RECAPTCHA_ACTIONS, getMinScoreForAction, getErrorMessageForAction } from "@/lib/recaptcha/actions";
import { isRecaptchaConfigured, getRecaptchaConfigStatus, isDevelopmentDomain } from "@/lib/recaptcha/domain-check";

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
  }
};

// Enhanced debugging for reCAPTCHA
if (typeof window !== 'undefined') {
  setupEnv();
  
  console.log("Login component - Environment:", process.env.NODE_ENV);
  console.log("Login component - RECAPTCHA_SITE_KEY available:", !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  console.log("Login component - window.__env available:", !!window.__env);
  
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

// Add to window global interface
declare global {
  interface Window {
    __env?: {
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY?: string;
      [key: string]: any;
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
    setCustomMessage
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
    if (isSubmitting && token && formRef.current && mode === "signup") {
      console.log("Token received while submitting, continuing submission");
      const formData = new FormData(formRef.current);
      formData.append("captchaToken", token);
      formAction(formData);
    }
  }, [token, isSubmitting, formAction, mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Only for signup mode
      if (mode === "signup") {
        console.log("Signup form submission started");
        resetVerification();
        setCustomMessage("Verifying your request...", 'loading');
        
        // Get environment and domain info
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isDevDomain = isDevelopmentDomain();
        const isVercelPreview = typeof window !== 'undefined' && 
          window.location.hostname.includes('vercel.app');
        
        // Skip reCAPTCHA verification in specific conditions:
        // 1. In development environment and not configured
        // 2. In Vercel preview deployments (for testing)
        // 3. When using test keys (for development)
        const usingTestKeys = typeof window !== 'undefined' && 
          window.__env?.usingTestKey === true;
          
        const shouldSkipVerification = 
          (!recaptchaConfigured && (isDevelopment || isDevDomain)) || 
          isVercelPreview;
        
        if (shouldSkipVerification) {
          console.warn("CAPTCHA verification skipped in development mode or preview deployment");
          setCustomMessage("Verification skipped in development/preview mode", 'warning');
          formAction(new FormData(event.currentTarget));
          return;
        }
        
        if (usingTestKeys && !isDevelopment && !isDevDomain) {
          console.warn("Using test reCAPTCHA keys in non-development environment");
          setCustomMessage("Using test verification keys (not secure for production)", 'warning');
        }
        
        // Execute verification with specific action for signup
        let captchaToken: string | null = null;
        
        try {
          captchaToken = await executeVerification(RECAPTCHA_ACTIONS.SIGNUP);
        } catch (error) {
          console.error("reCAPTCHA execution error:", error);
          
          // Check for specific error types
          const errorMessage = error instanceof Error ? error.message : "Failed to verify";
          const isConfigError = errorMessage.includes('not configured') || 
                              errorMessage.includes('missing');
          const isNetworkError = errorMessage.includes('network') || 
                               errorMessage.includes('failed to load');
                               
          if (isConfigError) {
            setCustomMessage(
              "reCAPTCHA verification unavailable. Please try again later or contact support.", 
              'error'
            );
            
            // After 3 seconds, offer to continue without verification
            setTimeout(() => {
              setCustomMessage(
                "Continue without verification? This reduces protection against spam.", 
                'warning'
              );
            }, 3000);
            
          } else if (isNetworkError) {
            setCustomMessage(
              "Network error during verification. Check your internet connection.", 
              'error'
            );
          } else {
            setCustomMessage(
              errorMessage, 
              'error'
            );
          }
          
          setIsSubmitting(false);
          return;
        }
        
        // If still no token after execution
        if (!captchaToken) {
          // Try one more time if less than 3 attempts
          if (captchaAttempts < 2) {
            console.log(`reCAPTCHA token generation failed, attempt ${captchaAttempts + 1}`);
            setCaptchaAttempts(prev => prev + 1);
            setCustomMessage(`Verification attempt ${captchaAttempts + 1}...`, 'loading');
            setTimeout(() => {
              setIsSubmitting(false);
              handleSubmit(event);
            }, 1500);
            return;
          } else {
            console.error("Failed to get reCAPTCHA token after multiple attempts");
            
            // After maximum attempts, provide option to continue anyway with warning
            setCustomMessage(
              "Verification unsuccessful after multiple attempts. You can try again or continue with reduced security.", 
              'warning'
            );
            setIsSubmitting(false);
            return;
          }
        }
        
        console.log("CAPTCHA token available:", !!captchaToken);
        console.log("CAPTCHA token length:", captchaToken?.length);
        
        // Create form data and add token
        const formData = new FormData(event.currentTarget);
        formData.append("captchaToken", captchaToken);
        
        // Submit the form with the token
        formAction(formData);
      } else if (mode === "signin") {
        // For signin, optionally add reCAPTCHA verification with a lower threshold
        // This is optional but can add additional security for login attempts
        
        // Only verify suspicious logins in production
        const needsVerification = false; // You can implement logic to determine if verification is needed
        
        if (needsVerification && recaptchaConfigured) {
          try {
            console.log("Verifying login attempt with reCAPTCHA");
            setCustomMessage("Verifying login attempt...", 'loading');
            const captchaToken = await executeVerification(RECAPTCHA_ACTIONS.LOGIN);
            
            if (captchaToken) {
              setCustomMessage("Verification successful", 'success');
              const formData = new FormData(event.currentTarget);
              formData.append("captchaToken", captchaToken);
              formAction(formData);
            } else {
              // Continue without verification if token generation fails
              setCustomMessage("Proceeding without verification", 'warning');
              formAction(new FormData(event.currentTarget));
            }
          } catch (error) {
            // If reCAPTCHA fails, still allow login but log the error
            console.error("reCAPTCHA verification for login failed:", error);
            setCustomMessage("Verification failed, proceeding anyway", 'warning');
            formAction(new FormData(event.currentTarget));
          }
        } else {
          // Regular sign-in without verification
          formAction(new FormData(event.currentTarget));
        }
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

        {mode === "signup" && (
          <div className="flex flex-col items-center">
            {/* Use ReCaptchaFeedback with our context state */}
            <div className="w-full my-2">
              <ReCaptchaFeedback 
                status={verificationStatus}
                message={verificationMessage}
                onRetry={() => executeVerification(RECAPTCHA_ACTIONS.SIGNUP)}
                onSkip={() => {
                  // Allow bypassing reCAPTCHA if it's not configured
                  setCustomMessage(
                    "Continuing without reCAPTCHA verification. This may reduce security.", 
                    "warning"
                  );
                  // Set a fake token for development
                  formAction(new FormData());
                }}
              />
            </div>
            
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
          </div>
        )}

        {state?.error && <div className="text-red-500 text-sm">{state.error}</div>}

        <div>
          <Button
            type="submit"
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-[#B4916C] hover:bg-[#B4916C]/75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
            disabled={pending || isSubmitting || (recaptchaLoading && mode === "signup" && recaptchaConfigured)}
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
