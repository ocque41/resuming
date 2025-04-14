"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DebugPage() {
  const [loading, setLoading] = useState(true);
  const [cvData, setCvData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/cv/optimized');
        const optimizedResponse = await response.json();
        
        const debugResponse = await fetch('/api/cv/debug');
        const debugData = await debugResponse.json();
        
        setCvData({
          optimized: optimizedResponse,
          debug: debugData
        });
      } catch (error) {
        console.error('Error fetching debug data:', error);
        setError('Failed to fetch debug data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDebugData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 text-[#B4916C] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-900/50 rounded-md p-4 text-red-300">
        <h2 className="text-lg font-bold mb-2">Error</h2>
        <p>{error}</p>
      </div>
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
        <h1 className="text-2xl font-bold text-[#F9F6EE] font-safiro">CV Debug Information</h1>
      </div>

      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <CardTitle>Available CVs Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-[#111] p-4 rounded-md overflow-auto max-h-[300px] text-xs text-[#F9F6EE]">
            {JSON.stringify(cvData?.optimized, null, 2)}
          </pre>
          <p className="mt-4 text-sm text-[#C5C2BA]">
            Count: {cvData?.optimized?.cvs?.length || 0} CVs
          </p>
        </CardContent>
      </Card>

      <Card className="bg-[#0A0A0A] border border-[#333333]">
        <CardHeader>
          <CardTitle>All CVs Debug Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[#C5C2BA]">
            Total CVs: {cvData?.debug?.totalCvs || 0}
          </p>
          
          {cvData?.debug?.cvs?.map((cv: any, index: number) => (
            <div 
              key={cv.id || index} 
              className="mb-6 p-4 border border-[#222] rounded-md"
            >
              <h3 className="text-lg font-medium text-[#F9F6EE] mb-2">
                {cv.fileName} (ID: {cv.id})
              </h3>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-[#111] p-2 rounded-md">
                  <span className="text-xs text-[#8A8782]">Has Optimized Tag:</span>
                  <span className={`ml-2 text-xs ${cv.hasOptimizedTag ? 'text-green-500' : 'text-red-500'}`}>
                    {cv.hasOptimizedTag ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="bg-[#111] p-2 rounded-md">
                  <span className="text-xs text-[#8A8782]">Has Optimized Path:</span>
                  <span className={`ml-2 text-xs ${cv.hasOptimizedPath ? 'text-green-500' : 'text-red-500'}`}>
                    {cv.hasOptimizedPath ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="bg-[#111] p-2 rounded-md">
                  <span className="text-xs text-[#8A8782]">Status:</span>
                  <span className="ml-2 text-xs text-[#F9F6EE]">{cv.status}</span>
                </div>
                
                <div className="bg-[#111] p-2 rounded-md">
                  <span className="text-xs text-[#8A8782]">Created:</span>
                  <span className="ml-2 text-xs text-[#F9F6EE]">
                    {new Date(cv.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="mb-2">
                <h4 className="text-sm font-medium text-[#B4916C] mb-1">Metadata</h4>
                <pre className="bg-[#111] p-2 rounded-md overflow-auto max-h-[150px] text-xs text-[#F9F6EE]">
                  {JSON.stringify(cv.metadata, null, 2)}
                </pre>
              </div>
              
              {cv.optimizedDocxPath && (
                <div>
                  <h4 className="text-sm font-medium text-[#B4916C] mb-1">Optimized DOCX Path</h4>
                  <pre className="bg-[#111] p-2 rounded-md overflow-auto text-xs text-[#F9F6EE]">
                    {cv.optimizedDocxPath}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
} 