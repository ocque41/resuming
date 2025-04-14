"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertTriangle, Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import Link from "next/link";

export default function ApplyPageClient({ hasUsageBasedPricing }: { hasUsageBasedPricing: boolean }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCV, setHasCV] = useState(false);
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [jobsToApply, setJobsToApply] = useState(25);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Fetch user's optimized CVs
  useEffect(() => {
    const fetchCVs = async () => {
      try {
        const response = await fetch('/api/cv/optimized');
        if (response.ok) {
          const data = await response.json();
          setCvOptions(data.cvs || []);
          setHasCV(data.cvs && data.cvs.length > 0);
          if (data.cvs && data.cvs.length > 0) {
            setSelectedCV(data.cvs[0].id);
          }
        } else {
          console.error('Error fetching optimized CVs');
          setHasCV(false);
        }
      } catch (err) {
        console.error('Error fetching optimized CVs:', err);
        setHasCV(false);
      }
    };
    
    fetchCVs();
  }, []);

  const handleApplyClick = async () => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // First check if user has usage-based pricing enabled
      if (!hasUsageBasedPricing) {
        // Create checkout session for enabling usage-based pricing
        const response = await fetch('/api/stripe/usage-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            returnUrl: '/dashboard/apply',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create checkout session');
        }

        const data = await response.json();
        setCheckoutUrl(data.url);
        setProcessingPayment(true);
        return;
      }

      // If user already has usage-based pricing, proceed with job application
      const applyResponse = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCV,
          jobCount: jobsToApply,
        }),
      });

      if (!applyResponse.ok) {
        const errorData = await applyResponse.json();
        throw new Error(errorData.message || 'Failed to apply to jobs');
      }

      const applyData = await applyResponse.json();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Job application error:', err);
    } finally {
      setLoading(false);
    }
  };

  // If we need to redirect to checkout
  useEffect(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  }, [checkoutUrl]);

  // If user has no optimized CVs, show message
  if (!hasCV) {
    return (
      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <CardTitle className="text-xl text-[#F9F6EE] font-safiro">No Optimized CVs Found</CardTitle>
          <CardDescription className="text-[#C5C2BA] font-borna">
            You need to optimize a CV before you can use the job application agent.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/dashboard/optimize">
            <Button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]">
              Optimize Your CV
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Show success message after application
  if (success) {
    return (
      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            <CardTitle className="text-xl text-[#F9F6EE] font-safiro">Application Process Started</CardTitle>
          </div>
          <CardDescription className="text-[#C5C2BA] font-borna">
            Our AI agent is now applying to {jobsToApply} jobs that match your CV. You'll receive an email when the process is complete.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/dashboard">
            <Button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]">
              Return to Dashboard
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // If there was an error
  if (error) {
    return (
      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
            <CardTitle className="text-xl text-[#F9F6EE] font-safiro">Error</CardTitle>
          </div>
          <CardDescription className="text-[#C5C2BA] font-borna">
            {error}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button 
            onClick={() => setError(null)}
            className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]">
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Processing payment
  if (processingPayment) {
    return (
      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <div className="flex items-center">
            <Loader2 className="h-6 w-6 text-[#B4916C] animate-spin mr-2" />
            <CardTitle className="text-xl text-[#F9F6EE] font-safiro">Processing Payment</CardTitle>
          </div>
          <CardDescription className="text-[#C5C2BA] font-borna">
            You're being redirected to Stripe to set up usage-based billing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Main application form
  return (
    <Card className="bg-[#0A0A0A] border border-[#333333]">
      <CardHeader>
        <div className="flex items-center">
          <Briefcase className="h-6 w-6 text-[#0A66C2] mr-2" />
          <CardTitle className="text-xl text-[#F9F6EE] font-safiro">AI Job Application Agent</CardTitle>
        </div>
        <CardDescription className="text-[#C5C2BA] font-borna">
          Our AI agent will search LinkedIn for jobs matching your CV, analyze them for fit, and apply to the best matches. 
          Each batch of applications costs $0.99.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="cv-select" className="text-[#F9F6EE] font-borna">Select your optimized CV</Label>
          <select 
            id="cv-select"
            value={selectedCV || ''}
            onChange={(e) => setSelectedCV(e.target.value)}
            className="w-full p-2 rounded-md bg-[#222] border border-[#333] text-[#F9F6EE]"
          >
            {cvOptions.map(cv => (
              <option key={cv.id} value={cv.id}>{cv.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="jobs-count" className="text-[#F9F6EE] font-borna">Number of jobs to apply for</Label>
            <span className="text-[#B4916C] font-bold">{jobsToApply}</span>
          </div>
          <Slider
            id="jobs-count"
            defaultValue={[25]}
            max={50}
            min={5}
            step={5}
            onValueChange={(values) => setJobsToApply(values[0])}
            className="w-full"
          />
          <p className="text-xs text-[#8A8782] italic mt-1">
            Adjust the slider to choose how many jobs to apply for (5-50)
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-[#F9F6EE] font-borna">
          Cost: <span className="text-[#B4916C] font-bold">$0.99</span>
        </div>
        <Button 
          onClick={handleApplyClick}
          disabled={loading || !selectedCV}
          className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] flex items-center"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {hasUsageBasedPricing ? "Apply Now" : "Enable & Apply"}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 