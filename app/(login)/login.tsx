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
import CustomCaptchaGame from "@/components/CustomCaptchaGame";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { signIn, signUp } from "./actions";
import { ActionState } from "@/lib/auth/middleware";

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
  
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string>("");
  
  // Reset captcha when form is submitted or errors occur
  useEffect(() => {
    if (state.error) {
      setCaptchaToken(null);
    }
  }, [state.error]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Debug output for form submission
    console.log("Form submission - mode:", mode);
    if (mode === "signup") {
      console.log("CAPTCHA token available:", !!captchaToken);
    }
    
    // Only check CAPTCHA for sign-up
    if (mode === "signup" && !captchaToken) {
      setCaptchaError("Please complete the CAPTCHA verification");
      return;
    }
    
    const formData = new FormData(event.currentTarget);
    
    // Add CAPTCHA token to form data if available
    if (captchaToken) {
      formData.append("captchaToken", captchaToken);
      console.log("CAPTCHA token added to form data, length:", captchaToken.length);
    }
    
    formAction(formData);
  };

  return (
    <form
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
            // Changed input background to a darker shade
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
          <div className="mb-2 text-xs text-gray-400">
            Please verify that you are human
          </div>
          <CustomCaptchaGame
            onSuccess={(token) => {
              console.log("CAPTCHA token received:", token ? "Yes (length: " + token.length + ")" : "No");
              setCaptchaToken(token);
              setCaptchaError("");
            }}
            onError={() => {
              setCaptchaToken(null);
              setCaptchaError("CAPTCHA verification failed, please try again");
            }}
          />
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
          disabled={pending || (mode === "signup" && !captchaToken)}
        >
          {pending ? (
            <>
              <Loader className="animate-spin mr-2 h-4 w-4" />
              Loading...
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

  // Reset CAPTCHA when switching between signin and signup
  useEffect(() => {
    console.log("Login mode changed:", mode);
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
      </div>
    </div>
  );
}
