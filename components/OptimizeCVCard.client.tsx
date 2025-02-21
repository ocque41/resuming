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
  const [optimizedResult, setOptimizedResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOptimize(cv: string) {
    setSelectedCV(cv);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/optimize-cv?fileName=${encodeURIComponent(cv)}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOptimizedResult(data.optimizedCV);
      }
    } catch (err: any) {
      setError("Failed to optimize CV.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
      <CardContent>
        <div className="flex justify-center items-center h-32 bg-gray-100 rounded-lg mb-4">
          <span className="text-gray-500">Animation Placeholder</span>
        </div>
        <ComboboxPopover
          label="Select a CV to Optimize"
          options={cvs}
          onSelect={(cv: string) => {
            console.log("Selected CV for optimization:", cv);
            handleOptimize(cv);
          }}
        />
        {loading && <p className="mt-4">Optimizing CV...</p>}
        {error && <p className="mt-4 text-red-500">{error}</p>}
        {optimizedResult && (
          <div className="mt-4 text-sm">
            <h3 className="font-bold mb-2">Optimized CV:</h3>
            <p>{optimizedResult}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
