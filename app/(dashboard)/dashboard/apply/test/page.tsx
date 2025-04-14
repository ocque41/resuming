"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, AlertTriangle, RefreshCw, Briefcase, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TestApplyPage() {
  const [loading, setLoading] = useState(false);
  const [fetchingCVs, setFetchingCVs] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCV, setHasCV] = useState(false);
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [jobApplications, setJobApplications] = useState<any[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch user's CVs
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
    fetchJobApplications();
  }, []);

  // Mock function to fetch previous job applications
  const fetchJobApplications = async () => {
    try {
      // In a real implementation, this would fetch from the database
      // For now, we'll just use mock data
      setJobApplications([
        {
          id: "test_1234",
          status: "completed",
          cvName: "Software Engineer CV",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          appliedJobs: 25,
          successfulApplications: 22,
          failedApplications: 3,
          testResults: {
            apiCallsMade: 8,
            tokensUsed: 18500,
            costEstimate: "$0.37",
            completionTime: "00:04:15"
          }
        }
      ]);
    } catch (err) {
      console.error("Error fetching job applications:", err);
    }
  };

  const handleTestClick = async () => {
    if (!selectedCV) {
      setError("Please select a CV first");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use the test endpoint that bypasses payment
      const applyResponse = await fetch('/api/jobs/apply-test', {
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
        throw new Error(errorData.message || errorData.error || 'Failed to apply to jobs');
      }

      const applyData = await applyResponse.json();
      console.log("Test apply response:", applyData);
      
      setTestResult(applyData);
      setActiveJobId(applyData.mockPaymentId);
      setSuccess(true);
      
      // Start polling for job status
      setIsPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Job application test error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Mock polling for job status
  useEffect(() => {
    if (!isPolling || !activeJobId) return;

    const pollInterval = setInterval(() => {
      console.log(`Polling for job status: ${activeJobId}`);
      
      // In a real implementation, this would check the job status in the database
      // For now, we'll just update the UI after a delay
      setTimeout(() => {
        setIsPolling(false);
        setJobApplications(prev => [
          {
            id: activeJobId,
            status: "completed",
            cvName: cvOptions.find(cv => cv.id === selectedCV)?.name || "Unknown CV",
            createdAt: new Date().toISOString(),
            appliedJobs: 25,
            successfulApplications: 23,
            failedApplications: 2,
            testResults: {
              apiCallsMade: 6,
              tokensUsed: 15800,
              costEstimate: "$0.32",
              completionTime: "00:03:55"
            }
          },
          ...prev
        ]);
        clearInterval(pollInterval);
      }, 10000);
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isPolling, activeJobId, cvOptions, selectedCV]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link href="/dashboard/apply" className="mr-4">
          <Button variant="ghost" size="sm" className="flex items-center gap-1 text-[#B4916C]">
            <ArrowLeft className="h-4 w-4" />
            Back to Apply
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-[#F9F6EE] font-safiro">
          Apply Agent Testing Mode
        </h1>
      </div>
      
      <div className="bg-amber-900/20 border border-amber-800/30 rounded-md p-4 text-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Code className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Testing Environment</h3>
        </div>
        <p className="text-sm">
          This page allows you to test the job application agent without processing a Stripe payment.
          All OpenAI API calls will still be made, so there will be some costs associated with testing.
        </p>
      </div>

      <Tabs defaultValue="run-test">
        <TabsList>
          <TabsTrigger value="run-test">Run Test</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="run-test" className="space-y-4">
          {/* If user has no CVs, show message */}
          {!hasCV ? (
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
          ) : success ? (
            // Show success message after application
            <Card className="bg-[#0A0A0A] border border-[#333333]">
              <CardHeader>
                <div className="flex items-center">
                  <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                  <CardTitle className="text-xl text-[#F9F6EE] font-safiro">Test Started</CardTitle>
                </div>
                <CardDescription className="text-[#C5C2BA] font-borna">
                  The job application agent has started in test mode. It will apply to 25 jobs that match your CV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isPolling ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 text-[#B4916C] animate-spin mr-3" />
                    <p className="text-[#F9F6EE]">Processing your test job applications...</p>
                  </div>
                ) : (
                  <div className="bg-[#111] p-4 rounded-md">
                    <h3 className="text-lg font-medium text-[#F9F6EE] mb-3">Test Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8A8782]">Test ID:</span>
                        <span className="text-[#F9F6EE]">{testResult?.mockPaymentId || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8782]">Job Count:</span>
                        <span className="text-[#F9F6EE]">25</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A8782]">Status:</span>
                        <span className="text-green-500">
                          {isPolling ? "In Progress" : "Completed"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button 
                  onClick={() => setSuccess(false)}
                  className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]"
                >
                  Run Another Test
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => document.querySelector('[data-value="results"]')?.dispatchEvent(new Event('click'))}
                >
                  View Test Results
                </Button>
              </CardFooter>
            </Card>
          ) : (
            // Main test form
            <Card className="bg-[#0A0A0A] border border-[#333333]">
              <CardHeader>
                <div className="flex items-center">
                  <Briefcase className="h-6 w-6 text-[#0A66C2] mr-2" />
                  <CardTitle className="text-xl text-[#F9F6EE] font-safiro">AI Job Application Test</CardTitle>
                </div>
                <CardDescription className="text-[#C5C2BA] font-borna">
                  Test the AI agent that will search LinkedIn for jobs matching your CV, analyze them for fit, and apply to the best matches.
                  This test will use your OpenAI API key but will not charge your credit card.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-md text-red-300 text-sm">
                    {error}
                  </div>
                )}
                
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
                      Est. OpenAI Cost: <span className="text-[#B4916C] font-bold">$0.25-$0.50</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button 
                  onClick={handleTestClick}
                  disabled={loading || !selectedCV}
                  className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Run Test"
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="results" className="space-y-4">
          <Card className="bg-[#0A0A0A] border border-[#333333]">
            <CardHeader>
              <CardTitle className="text-xl text-[#F9F6EE] font-safiro">Test Results</CardTitle>
              <CardDescription className="text-[#C5C2BA] font-borna">
                View results from previous test runs of the job application agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobApplications.length === 0 ? (
                <div className="text-center py-8 text-[#8A8782]">
                  No test results found. Run a test first.
                </div>
              ) : (
                <div className="space-y-6">
                  {jobApplications.map((job) => (
                    <div key={job.id} className="border border-[#222] rounded-md p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-[#F9F6EE]">{job.cvName}</h3>
                          <p className="text-sm text-[#8A8782]">
                            Test ID: {job.id}
                          </p>
                          <p className="text-xs text-[#8A8782]">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="px-3 py-1 bg-green-900/30 text-green-500 rounded-full text-xs font-medium">
                          {job.status}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-[#111] p-3 rounded-md">
                          <div className="text-sm text-[#8A8782] mb-1">Applications</div>
                          <div className="text-lg font-medium text-[#F9F6EE]">{job.appliedJobs}</div>
                        </div>
                        <div className="bg-[#111] p-3 rounded-md">
                          <div className="text-sm text-[#8A8782] mb-1">Success Rate</div>
                          <div className="text-lg font-medium text-green-500">
                            {Math.round((job.successfulApplications / job.appliedJobs) * 100)}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#111] p-3 rounded-md mb-3">
                        <h4 className="text-sm font-medium text-[#B4916C] mb-2">API Usage</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[#8A8782]">API Calls:</span>
                            <span className="text-[#F9F6EE]">{job.testResults.apiCallsMade}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8782]">Tokens Used:</span>
                            <span className="text-[#F9F6EE]">{job.testResults.tokensUsed.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8782]">Est. Cost:</span>
                            <span className="text-[#F9F6EE]">{job.testResults.costEstimate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8782]">Duration:</span>
                            <span className="text-[#F9F6EE]">{job.testResults.completionTime}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <div>
                          <span className="text-[#8A8782]">Successful:</span>
                          <span className="ml-1 text-green-500">{job.successfulApplications}</span>
                        </div>
                        <div>
                          <span className="text-[#8A8782]">Failed:</span>
                          <span className="ml-1 text-red-400">{job.failedApplications}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={fetchJobApplications}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Results
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 