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
import { useReCaptchaV3, ReCaptchaV3Provider } from "@/components/ui/recaptcha-v3";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { signIn, signUp } from "./actions";
import { ActionState } from "@/lib/auth/middleware";

// Enhanced debugging for reCAPTCHA
if (typeof window !== 'undefined') {
  console.log("Login component - Environment:", process.env.NODE_ENV);
  console.log("Login component - RECAPTCHA_SITE_KEY available:", !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    console.log("Login component - RECAPTCHA_SITE_KEY length:", process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length);
    console.log("Login component - RECAPTCHA_SITE_KEY first 5 chars:", process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 5));
  }
}

const createAction = (mode: "signin" | "signup") => (data: FormData) => {
  if (mode === "signin") {
    return signIn({ error: "", email: "", password: "" }, data).then(
      (res) => res ?? { error: "", email: "", password: "" }
    );
  } else {
    return signUp({ error: "", email: "", password: "" }, data).then(
      (res) => res ?? { error: "", email: "", password: "" }
    );
  }
};

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect");
  const priceId = searchParams?.get("priceId");
  const inviteId = searchParams?.get("inviteId");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAction(mode),
    { error: "", email: "", password: "" }
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaError, setCaptchaError] = useState<string>("");
  const [captchaAttempts, setCaptchaAttempts] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Use the reCAPTCHA v3 hook
  const { executeReCaptcha, token: captchaToken, error: recaptchaError, loading: recaptchaLoading } = useReCaptchaV3();
  
  // Pre-load reCAPTCHA token on component mount for signup
  useEffect(() => {
    if (mode === "signup" && !captchaToken && !recaptchaLoading && !recaptchaError) {
      const preloadToken = async () => {
        console.log("Preloading reCAPTCHA token");
        try {
          const token = await executeReCaptcha('signup_preload');
          console.log("Preloaded reCAPTCHA token:", token ? "success" : "failed");
        } catch (error) {
          console.error("Error preloading reCAPTCHA token:", error);
        }
      };
      preloadToken();
    }
  }, [mode, captchaToken, recaptchaLoading, recaptchaError, executeReCaptcha]);
  
  // Handle reCAPTCHA errors
  useEffect(() => {
    if (recaptchaError) {
      console.error('reCAPTCHA error:', recaptchaError);
      setCaptchaError(`reCAPTCHA error: ${recaptchaError.message}`);
    }
  }, [recaptchaError]);

  // If token is loaded after user started submitting, continue submission
  useEffect(() => {
    if (isSubmitting && captchaToken && formRef.current && mode === "signup") {
      console.log("Token received while submitting, continuing submission");
      const formData = new FormData(formRef.current);
      formData.append("captchaToken", captchaToken);
      formAction(formData);
    }
  }, [captchaToken, isSubmitting, formAction, mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Only for signup mode
      if (mode === "signup") {
        console.log("Signup form submission started");
        setCaptchaError("");
        
        // If we already have a token, use it
        let token = captchaToken;
        
        // If not, try to get one
        if (!token) {
          console.log("No reCAPTCHA token available, executing verification");
          setCaptchaAttempts(prev => prev + 1);
          
          try {
            token = await executeReCaptcha('signup');
            console.log("reCAPTCHA execution result:", token ? "success" : "failed");
          } catch (error) {
            console.error("reCAPTCHA execution error:", error);
            setCaptchaError(`reCAPTCHA error: ${error instanceof Error ? error.message : "Failed to verify"}`);
            setIsSubmitting(false);
            return;
          }
          
          // If still no token after execution
          if (!token) {
            // Try one more time if less than 3 attempts
            if (captchaAttempts < 2) {
              console.log(`reCAPTCHA token generation failed, attempt ${captchaAttempts + 1}`);
              setCaptchaError("CAPTCHA verification in progress. Please wait...");
              setTimeout(() => {
                setIsSubmitting(false);
                handleSubmit(event);
              }, 1500);
              return;
            } else {
              console.error("Failed to get reCAPTCHA token after multiple attempts");
              setCaptchaError("CAPTCHA verification failed. Please refresh the page and try again.");
              setIsSubmitting(false);
              return;
            }
          }
        }
        
        console.log("CAPTCHA token available:", !!token);
        console.log("CAPTCHA token length:", token?.length);
        
        // Create form data and add token
        const formData = new FormData(event.currentTarget);
        formData.append("captchaToken", token);
        
        // Submit the form with the token
        formAction(formData);
      } else {
        // For signin, just submit the form
        formAction(new FormData(event.currentTarget));
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setCaptchaError(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsSubmitting(false);
    }
  };

  return (
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
          {/* reCAPTCHA v3 doesn't require user interaction, but we show verification status */}
          {(recaptchaLoading || isSubmitting) && (
            <div className="flex items-center text-sm text-gray-400 my-2">
              <Loader className="animate-spin mr-2 h-4 w-4" />
              {recaptchaLoading ? "Loading verification..." : "Verifying..."}
            </div>
          )}
          
          {captchaError && <div className="text-red-500 text-sm mt-2">{captchaError}</div>}
          
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
          disabled={pending || isSubmitting || recaptchaLoading}
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
  );
}

export function Login({ mode = "signin" }: { mode?: "signin" | "signup" }) {
  const router = useRouter();

  // Debug log on component mount
  useEffect(() => {
    console.log("Login mode:", mode);
  }, [mode]);

  return (
    <ReCaptchaV3Provider>
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
        </div>
      </div>
    </ReCaptchaV3Provider>
  );
}
