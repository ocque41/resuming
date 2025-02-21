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
  const [optimizedResult, setOptimizedResult] = useState<{
    optimizedCV: string;
    optimizedPDFUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  async function handleOptimize(cv: string) {
    setSelectedCV(cv);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/optimize-cv?fileName=${encodeURIComponent(cv)}`
      );
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOptimizedResult({
          optimizedCV: data.optimizedCV,
          optimizedPDFUrl: data.optimizedPDFUrl,
        });
        setShowModal(true);
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
        {showModal && optimizedResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Optimized CV Preview</h2>
              <p className="mb-4 text-sm">{optimizedResult.optimizedCV}</p>
              <a
                href={optimizedResult.optimizedPDFUrl}
                download="optimized-cv.pdf"
                className="bg-blue-500 text-white px-4 py-2 rounded inline-block"
              >
                Download Optimized CV
              </a>
              <button
                className="mt-4 text-gray-600"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
