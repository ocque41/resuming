// SpecificOptimizeCVCard.client.tsx
// This component provides a tailored CV optimization for a specific job description.

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SpecificOptimizeCVCardProps {
  selectedCVId: string;
  selectedCVName?: string;
}

export default function SpecificOptimizeCVCard({ selectedCVId, selectedCVName }: SpecificOptimizeCVCardProps) {
  const [jobDescription, setJobDescription] = useState<string>("");
  const [optimizedCV, setOptimizedCV] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setOptimizedCV("");
    try {
      const response = await fetch("/api/cv/process/job-specific", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId: selectedCVId, jobDescription: jobDescription }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to optimize CV for job.");
      }
      setOptimizedCV(data.optimizedText || "Optimization successful, but no output provided.");
    } catch (err: any) {
      console.error("Error during job-specific optimization:", err);
      setError(err.message || "An error occurred during job-specific optimization.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border border-[#B4916C]/20 bg-[#121212]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#B4916C]">Job-Specific Optimization</CardTitle>
        <CardDescription className="text-gray-400">
          Optimize your CV for a specific job. Please paste the job description below.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {error && (
          <Alert className="bg-destructive/10">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description here..."
          className="bg-[#2A2A2A] border-gray-700 text-white"
        />
        <Button
          onClick={handleOptimize}
          disabled={isLoading || !jobDescription.trim()}
          className="bg-[#B4916C] hover:bg-[#A27D59] text-[#050505]"
        >
          {isLoading ? "Optimizing..." : "Optimize CV"}
        </Button>
        {optimizedCV && (
          <div className="mt-4 p-4 border border-dashed border-gray-700 rounded-lg bg-[#050505] text-white">
            <p className="font-semibold mb-2">Optimized CV:</p>
            <div className="whitespace-pre-wrap text-sm">{optimizedCV}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 