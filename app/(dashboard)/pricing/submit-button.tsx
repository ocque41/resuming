"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

export function SubmitButton({ className }: { className?: string }) {
  const pending = false; // Replace with actual form status logic

  return (
    <Button
      type="submit"
      disabled={pending}
      className={`w-full bg-[#E8DCC4] hover:bg-[#E8DCC4]/90 text-[#050505] border border-[#E8DCC4] rounded-full flex items-center justify-center ${className || ""}`}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Loading...
        </>
      ) : (
        <>
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
