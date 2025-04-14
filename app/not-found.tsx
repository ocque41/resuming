"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  const router = useRouter();

  // Auto-redirect to dashboard after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      <Card className="max-w-md w-full bg-[#0A0A0A] border border-[#333333]">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-[#B4916C]" />
          </div>
          <CardTitle className="text-2xl font-safiro text-[#F9F6EE]">
            Page Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#C5C2BA] text-center mb-4">
            The page you're looking for doesn't exist or you may have been redirected here after completing a payment.
          </p>
          <p className="text-[#8A8782] text-sm text-center">
            You'll be automatically redirected to the dashboard in 5 seconds.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/dashboard">
            <Button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]">
              Go to Dashboard
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
