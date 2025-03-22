"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertTriangle, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NewsletterFormProps {
  placeholder?: string;
  buttonText?: string;
  className?: string;
  onSuccess?: () => void;
}

export default function NewsletterForm({
  placeholder = "Enter your email",
  buttonText = "Subscribe",
  className = "",
  onSuccess
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(true);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Reset states
    setError("");
    
    // Validate email
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    // Submit the form
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setShowForm(false);
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || "Failed to subscribe. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again later.");
      console.error("Newsletter subscription error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col space-y-4"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-grow">
                <Input
                  type="email"
                  placeholder={placeholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-[#111111] border border-[#222222] text-[#F9F6EE] focus:border-[#B4916C] focus:ring-[#B4916C] placeholder-[#777777]"
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] rounded-xl font-medium transition-colors duration-300 min-w-24"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  buttonText
                )}
              </Button>
            </div>
            
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center text-red-400 text-sm mt-1"
              >
                <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </motion.form>
        ) : success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-[#0D1F15]/50 border border-[#164430] p-4 text-center"
          >
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
              <span className="text-green-500 font-medium">Subscribed!</span>
            </div>
            <p className="text-[#C5C2BA] text-sm">
              Thank you for subscribing to our newsletter. You'll be the first to know about our latest updates.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
} 