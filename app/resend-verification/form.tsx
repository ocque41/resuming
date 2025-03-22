"use client";

import React, { useState } from 'react';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resendVerificationEmail } from './actions';

export default function ResendVerificationForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await resendVerificationEmail(email);
      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      {result ? (
        <div className={`p-4 rounded-lg mb-6 text-center ${result.success ? 'bg-[#0D1F15] text-[#4ADE80]' : 'bg-[#1A0505] text-[#F87171]'}`}>
          <p className="text-sm">{result.message}</p>
          {result.success && (
            <p className="text-sm mt-2 text-gray-400">
              Please check your inbox and spam folder for the verification email.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-white">
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-[#333333] rounded-md bg-[#1A1A1A] text-white focus:ring-[#B4916C] focus:border-[#B4916C]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <Button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#050505] bg-[#B4916C] hover:bg-[#B4916C]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B4916C]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader className="animate-spin mr-2 h-4 w-4" />
                Sending...
              </>
            ) : (
              'Send Verification Email'
            )}
          </Button>
        </form>
      )}
    </>
  );
} 