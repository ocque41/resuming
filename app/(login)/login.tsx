"use client";

import Link from "next/link";
import { useActionState } from "@/lib/useActionState";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { signIn } from "./actions";
import { ActionState } from "@/lib/auth/middleware";

const signInAction = (data: FormData) =>
  signIn({ error: "", email: "", password: "" }, data).then(
    (res) => res ?? { error: "", email: "", password: "" }
  );

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const priceId = searchParams.get("priceId");
  const inviteId = searchParams.get("inviteId");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    { error: "", email: "", password: "" }
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        formAction(new FormData(event.currentTarget));
      }}
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
            className="appearance-none rounded-full block w-full px-3 py-2 border border-[#B4916C]/30 placeholder-[#B4916C] text-white bg-[#2C2420] focus:outline-none focus:ring-[#584235] focus:border-[#584235] sm:text-sm"
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
            className="appearance-none rounded-full block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-white bg-[#2C2420] focus:outline-none focus:ring-[#584235] focus:border-[#584235] sm:text-sm"
            placeholder="Enter your password"
          />
        </div>
      </div>

      {state?.error && <div className="text-red-500 text-sm">{state.error}</div>}

      <div>
        <Button
          type="submit"
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-[#B4916C] hover:bg-[#B4916C]/75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
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
            <Tabs defaultValue={mode}>
              <TabsList className="w-full justify-center">
                <TabsTrigger
                  value="signin"
                  onClick={() => {
                    if (mode !== "signin") router.push("/sign-in");
                  }}
                  className="w-full transition-colors duration-300 hover:bg-[#B4916C]/75 data-[state=active]:bg-[#B4916C]/50"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  onClick={() => {
                    if (mode !== "signup") router.push("/sign-up");
                  }}
                  className="w-full transition-colors duration-300 hover:bg-[#B4916C]/75 data-[state=active]:bg-[#B4916C]/50"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
              <TabsContent value={mode}>
                <AuthForm mode={mode} />
              </TabsContent>
            </Tabs>
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
