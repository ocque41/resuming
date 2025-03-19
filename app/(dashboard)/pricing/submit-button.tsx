"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function SubmitButton({ className }: { className?: string }) {
  const pending = false; // Replace with actual form status logic

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full ${className || ""}`}
    >
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] rounded-xl py-6 flex items-center justify-center transition-colors duration-300 text-base font-medium shadow-lg border-none"
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            <span className="font-safiro">Loading...</span>
          </>
        ) : (
          <>
            <span className="font-safiro">Get Started</span>
            <motion.div
              initial={{ x: 0 }}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowRight className="ml-2 h-4 w-4" />
            </motion.div>
          </>
        )}
      </Button>
    </motion.div>
  );
}
