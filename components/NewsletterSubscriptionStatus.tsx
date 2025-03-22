"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NewsletterSubscriptionStatusProps {
  email: string;
  initialSubscribed?: boolean;
}

export default function NewsletterSubscriptionStatus({
  email,
  initialSubscribed = false,
}: NewsletterSubscriptionStatusProps) {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(initialSubscribed);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");

  const handleToggleSubscription = async () => {
    if (isSubscribing) return;

    setIsSubscribing(true);
    setSubscriptionSuccess(false);
    setSubscriptionError("");

    try {
      const endpoint = subscriptionStatus
        ? "/api/unsubscribe"  // If currently subscribed, we're unsubscribing
        : "/api/subscribe";   // If not subscribed, we're subscribing

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Toggle the subscription status
        setSubscriptionStatus(!subscriptionStatus);
        setSubscriptionSuccess(true);
      } else {
        setSubscriptionError(data.error || "Failed to update subscription. Please try again.");
      }
    } catch (err) {
      setSubscriptionError("An unexpected error occurred. Please try again later.");
      console.error("Newsletter subscription error:", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
      <CardHeader className="bg-[#0D0D0D] pb-4 border-b border-[#222222]">
        <CardTitle className="text-xl font-bold text-[#F9F6EE] font-safiro flex items-center">
          <Mail className="w-5 h-5 mr-2 text-[#B4916C]" />
          Newsletter Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#F9F6EE] font-borna">
                <span className="font-medium">Email: </span>
                {email}
              </p>
              <p className="text-[#8A8782] font-borna text-sm mt-1">
                Receive news, updates, and optimization tips in your inbox.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="newsletter-subscription"
                checked={subscriptionStatus}
                onCheckedChange={handleToggleSubscription}
                disabled={isSubscribing}
                className="data-[state=checked]:bg-[#B4916C]"
              />
              <Label
                htmlFor="newsletter-subscription"
                className="text-[#F9F6EE] font-borna cursor-pointer"
              >
                {subscriptionStatus ? "Subscribed" : "Not Subscribed"}
              </Label>
            </div>
          </div>

          {isSubscribing && (
            <div className="flex items-center justify-center text-[#B4916C] py-2">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              <span className="text-sm font-borna">
                {subscriptionStatus ? "Unsubscribing..." : "Subscribing..."}
              </span>
            </div>
          )}

          {subscriptionSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#0D1F15]/50 border border-[#164430] rounded-lg p-3 text-sm flex items-start"
            >
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-green-500">
                {subscriptionStatus
                  ? "Successfully subscribed to our newsletter."
                  : "Successfully unsubscribed from our newsletter."}
              </span>
            </motion.div>
          )}

          {subscriptionError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#1A0505]/50 border border-[#6B2222] rounded-lg p-3 text-sm flex items-start"
            >
              <AlertTriangle className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-red-400">{subscriptionError}</span>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 