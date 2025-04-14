"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertTriangle, Briefcase, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ApplyPageClient({ hasUsageBasedPricing }: { hasUsageBasedPricing: boolean }) {
  const [loading, setLoading] = useState(false);
  const [fetchingCVs, setFetchingCVs] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCV, setHasCV] = useState(false);
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<Array<{ id: string; name: string }>>([]);
  // Fixed job count at 25
  const jobsToApply = 25;
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Fetch user's optimized CVs
  const fetchCVs = async () => {
    setFetchingCVs(true);
    setError(null);
    
    try {
      console.log("Fetching CVs...");
      const response = await fetch('/api/cv/optimized');
      
      if (response.ok) {
        const data = await response.json();
        console.log("CVs response:", data);
        
        setCvOptions(data.cvs || []);
        setHasCV(data.cvs && data.cvs.length > 0);
        
        if (data.cvs && data.cvs.length > 0) {
          setSelectedCV(data.cvs[0].id);
        }
      } else {
        console.error('Error fetching CVs:', response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setHasCV(false);
        setError("Failed to load CVs. Please try again.");
      }
    } catch (err) {
      console.error('Error fetching CVs:', err);
      setHasCV(false);
      setError("Failed to load CVs. Please try again.");
    } finally {
      setFetchingCVs(false);
    }
  };
  
  useEffect(() => {
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

  // Loading state while fetching CVs
  if (fetchingCVs) {
    return (
      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <div className="flex items-center">
            <Loader2 className="h-6 w-6 text-[#B4916C] animate-spin mr-2" />
            <CardTitle className="text-xl text-[#F9F6EE] font-safiro">Loading CVs</CardTitle>
          </div>
          <CardDescription className="text-[#C5C2BA] font-borna">
            Retrieving your CVs...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // If user has no CVs, show message
  if (!hasCV) {
    return (
      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <CardTitle className="text-xl text-[#F9F6EE] font-safiro">No CVs Found</CardTitle>
          <CardDescription className="text-[#C5C2BA] font-borna">
            You need to upload a CV before you can use the job application agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}
          
          <div className="mt-2 text-sm text-[#8A8782]">
            <p>If you believe this is an error and you have already uploaded CVs, you can:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Click the Refresh button below to try again</li>
              <li>Go to the dashboard and check if your CVs are visible</li>
              <li>
                <Link href="/dashboard/apply/debug" className="text-[#B4916C] hover:underline">
                  View technical debug information
                </Link>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Link href="/dashboard">
            <Button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]">
              Upload a CV
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={fetchCVs} 
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
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
            Our AI agent is now applying to 25 jobs that match your CV. You'll receive an email when the process is complete.
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
          Each batch costs $0.99 and includes 25 job applications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="cv-select" className="text-[#F9F6EE] font-borna">Select your CV</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchCVs} 
              className="h-6 px-2 text-[#B4916C] hover:text-[#B4916C] hover:bg-[#B4916C]/10"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>
          
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
          <p className="text-xs text-[#8A8782]">
            Found {cvOptions.length} CV{cvOptions.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="px-4 py-5 bg-[#111] rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-[#8A8782] font-borna">Number of job applications:</span>
              <span className="ml-2 text-lg text-[#F9F6EE] font-bold">25</span>
            </div>
            <div className="text-[#F9F6EE] font-borna">
              Cost: <span className="text-[#B4916C] font-bold">$0.99</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
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