"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertTriangle, Briefcase, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import Link from "next/link";
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check as CheckIcon, RefreshCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

export default function ApplyPageClient({ hasUsageBasedPricing }: { hasUsageBasedPricing: boolean }) {
  const searchParams = useSearchParams();
  const success = searchParams?.get('success');
  const canceled = searchParams?.get('canceled');
  const jobCountParam = searchParams?.get('jobCount');

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [cvs, setCvs] = useState<string[]>([]);
  const [selectedCv, setSelectedCv] = useState<string>('');
  const [loadingCvs, setLoadingCvs] = useState(true);
  const [jobCount, setJobCount] = useState(jobCountParam ? parseInt(jobCountParam) : 25);
  const [usageEnabled, setUsageEnabled] = useState(hasUsageBasedPricing);
  const router = useRouter();

  // Get jobs count options
  const jobCountOptions = [5, 10, 25, 50, 100];

  useEffect(() => {
    if (success) {
      setUsageEnabled(true);
    }
  }, [success]);

  useEffect(() => {
    async function fetchCvs() {
      try {
        const res = await fetch('/api/cv/optimized');
        if (!res.ok) throw new Error('Failed to fetch CVs');
        const data = await res.json();
        
        // Format the data to the expected format
        const formattedCvs = data.cvs ? data.cvs.map((cv: any) => cv.id) : [];
        setCvs(formattedCvs);
        
        if (formattedCvs.length > 0) {
          setSelectedCv(formattedCvs[0]);
        }
      } catch (error) {
        console.error('Error fetching CVs:', error);
        setCvs([]);
      } finally {
        setLoadingCvs(false);
      }
    }

    fetchCvs();
  }, []);

  const handleGetStarted = async () => {
    setIsLoading(true);
    setIsError(false);
    setIsSuccess(false);

    try {
      const response = await fetch('/api/stripe/usage-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobCount,
          returnUrl: '/dashboard/apply',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error:', error);
      setIsError(true);
      toast.error('Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedCv) {
      toast.error('Please select a CV to use');
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setIsSuccess(false);

    try {
      const response = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cv: selectedCv,
          jobCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.needsPayment) {
          handleGetStarted();
          return;
        }
        throw new Error(errorData.error || 'Failed to apply for jobs');
      }

      setIsSuccess(true);
      toast.success('Successfully applied to jobs!');
    } catch (error) {
      console.error('Error:', error);
      setIsError(true);
      toast.error('Failed to apply for jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const resetApplication = () => {
    setIsSuccess(false);
    setIsError(false);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Auto-Apply to Jobs</h1>

      {!isSuccess && !isError && (
        <Card className="w-full p-6 bg-white shadow-lg rounded-lg">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">1. Select your CV</h2>
            {loadingCvs ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : cvs.length === 0 ? (
              <p className="text-gray-500">
                No optimized CVs found. Please create one first.
              </p>
            ) : (
              <Select
                value={selectedCv}
                onValueChange={setSelectedCv}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a CV" />
                </SelectTrigger>
                <SelectContent>
                  {cvs.map((cv) => (
                    <SelectItem key={cv} value={cv}>
                      {cv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              2. How many jobs to apply for?
            </h2>
            <div className="flex items-center space-x-4">
              <Select
                value={jobCount.toString()}
                onValueChange={(value) => setJobCount(parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Jobs" />
                </SelectTrigger>
                <SelectContent>
                  {jobCountOptions.map((count) => (
                    <SelectItem key={count} value={count.toString()}>
                      {count} jobs
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-gray-500">
                Cost: ${(jobCount * 0.99).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              3. Apply to LinkedIn jobs
            </h2>
            <p className="text-gray-500 mb-4">
              We&apos;ll automatically apply to the most relevant jobs for you
              based on your CV.
            </p>

            {usageEnabled || success ? (
              <Button
                onClick={handleApply}
                disabled={isLoading || !selectedCv}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </div>
                ) : 'Apply Now'}
              </Button>
            ) : (
              <Button
                onClick={handleGetStarted}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  `Enable Usage ($${(jobCount * 0.99).toFixed(2)})`
                )}
              </Button>
            )}

            {canceled && (
              <p className="text-red-500 mt-2">
                Payment canceled. You can try again.
              </p>
            )}
          </div>
        </Card>
      )}

      {isSuccess && (
        <Card className="w-full p-6 bg-white shadow-lg rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Application Complete!</h2>
            <p className="text-gray-600 mb-6">
              We&apos;ve successfully applied to {jobCount} jobs for you. You&apos;ll receive
              notifications for any responses.
            </p>
            <Button onClick={resetApplication} className="flex items-center">
              <RefreshCcw className="w-4 h-4 mr-2" /> Start New Application
            </Button>
          </div>
        </Card>
      )}

      {isError && (
        <Card className="w-full p-6 bg-white shadow-lg rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-600 text-xl">×</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-6">
              We couldn&apos;t complete your application. Please try again.
            </p>
            <Button onClick={resetApplication} className="flex items-center">
              <RefreshCcw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
} 