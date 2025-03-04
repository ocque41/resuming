// OptimizeCVCard.client.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";

interface OptimizeCVCardProps {
  cvs: string[];
}

export default function OptimizeCVCard({ cvs }: OptimizeCVCardProps) {
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [optimizationStatus, setOptimizationStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [optimizedPDFBase64, setOptimizedPDFBase64] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const maxRetries = 20;
  const pollingInterval = 5000;

  async function handleOptimize(cv: string) {
    setSelectedCV(cv);
    setError(null);
    setOptimizationStatus("pending");
    setPollingAttempts(0);
    
    try {
      const response = await fetch(`/api/optimize-cv?fileName=${encodeURIComponent(cv)}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setOptimizationStatus("error");
      } else {
        setOptimizationStatus("processing");
        setTimeout(() => pollOptimizationStatus(cv), 2000);
      }
    } catch (err: any) {
      setError("Failed to initiate optimization.");
      setOptimizationStatus("error");
    }
  }

  // Poll for updated CV status with a maximum number of retries.
  async function pollOptimizationStatus(cv: string) {
    try {
      const res = await fetch(`/api/get-cv-status?fileName=${encodeURIComponent(cv)}`);
      
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      
      const statusData = await res.json();
      
      if (statusData.optimized && statusData.optimizedPDFBase64) {
        setOptimizedPDFBase64(statusData.optimizedPDFBase64);
        setOptimizationStatus("complete");
        return;
      }
      
      if (statusData.error) {
        setError(`Optimization error: ${statusData.error}`);
        setOptimizationStatus("error");
        return;
      }
      
      setPollingAttempts(prev => prev + 1);
      
      if (pollingAttempts >= maxRetries) {
        setError("Optimization timed out. The process may still be running in the background. Please refresh and check again in a few moments.");
        setOptimizationStatus("error");
      } else {
        setTimeout(() => pollOptimizationStatus(cv), pollingInterval);
      }
    } catch (error: any) {
      console.error("Error polling CV status:", error);
      
      setPollingAttempts(prev => prev + 1);
      
      if (pollingAttempts >= maxRetries) {
        setError(`Polling error: ${error.message}. The optimization may still be running in the background.`);
        setOptimizationStatus("error");
      } else {
        setTimeout(() => pollOptimizationStatus(cv), pollingInterval);
      }
    }
  }

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
      <CardContent>
        <div className="flex justify-center items-center h-64 bg-gray-100 rounded-lg mb-4">
          <img
            src="/animations/leep.gif"
            alt="Animation"
            className="w-full h-full object-cover"
          />
        </div>
        <ComboboxPopover
          label="Optimize"
          options={cvs}
          onSelect={(cv: string) => {
            console.log("Selected CV for optimization:", cv);
            handleOptimize(cv);
          }}
        />
        {optimizationStatus === "pending" && (
          <p className="mt-4 text-sm">
            Optimization initiated. Waiting for processing...
          </p>
        )}
        {optimizationStatus === "processing" && (
          <p className="mt-4 text-sm">
            Optimizing CV... Please wait. (Attempt {pollingAttempts + 1}/{maxRetries})
          </p>
        )}
        {optimizationStatus === "complete" && optimizedPDFBase64 && (
          <div className="mt-4 text-sm">
            <h3 className="font-bold mb-2">Optimized CV Ready</h3>
            <iframe
              className="w-full h-96 border"
              src={`data:application/pdf;base64,${optimizedPDFBase64}`}
            ></iframe>
            <a
              href={`data:application/pdf;base64,${optimizedPDFBase64}`}
              download="optimized-cv.pdf"
              className="bg-blue-500 text-white px-4 py-2 rounded inline-block mt-2"
            >
              Download Optimized CV
            </a>
          </div>
        )}
        {error && <p className="mt-4 text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
