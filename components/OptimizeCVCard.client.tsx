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
  const maxRetries = 10;

  async function handleOptimize(cv: string) {
    setSelectedCV(cv);
    setError(null);
    setOptimizationStatus("pending");
    try {
      const response = await fetch(`/api/optimize-cv?fileName=${encodeURIComponent(cv)}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setOptimizationStatus("error");
      } else {
        setOptimizationStatus("processing");
        pollOptimizationStatus(cv);
      }
    } catch (err: any) {
      setError("Failed to initiate optimization.");
      setOptimizationStatus("error");
    }
  }

  // Poll for updated CV status with a maximum number of retries.
  async function pollOptimizationStatus(cv: string) {
    let localRetryCount = 0;
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/get-cv-status?fileName=${encodeURIComponent(cv)}`);
        const statusData = await res.json();
        if (statusData.optimized && statusData.optimizedPDFBase64) {
          setOptimizedPDFBase64(statusData.optimizedPDFBase64);
          setOptimizationStatus("complete");
          clearInterval(intervalId);
        } else {
          localRetryCount++;
          if (localRetryCount >= maxRetries) {
            clearInterval(intervalId);
            setError("Optimization timed out. Please try again later.");
            setOptimizationStatus("error");
          }
        }
      } catch (error) {
        console.error("Error polling CV status:", error);
      }
    }, 3000);
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
          <p className="mt-4 text-sm">Optimizing CV... Please wait.</p>
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
