/* use client */
'use client';

import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EnhancedSpecificOptimizationWorkflowProps {
  cvs?: string[];
}

export default function EnhancedSpecificOptimizationWorkflow({ cvs = [] }: EnhancedSpecificOptimizationWorkflowProps) {
  const [activeTab, setActiveTab] = useState('jobDescription');
  const [jobDescription, setJobDescription] = useState('');
  const [optimizedCV, setOptimizedCV] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);

  const handleCVSelect = (value: string) => {
    try {
      const parts = value.split('|');
      if (parts.length >= 2) {
        setSelectedCVId(parts[1]);
        setSelectedCVName(parts[0]);
      }
    } catch (error) {
      console.error("Error selecting CV:", error);
    }
  };

  const handleOptimize = () => {
    if (!selectedCVId || !jobDescription) return;
    
    setLoading(true);
    // Simulate an asynchronous API call for CV optimization
    setTimeout(() => {
      const result = `Optimized CV "${selectedCVName}" tailored for the job description:\n\n${jobDescription.substring(0, 100)}${jobDescription.length > 100 ? '...' : ''}`;
      setOptimizedCV(result);
      setLoading(false);
      setActiveTab('optimizedCV');
    }, 2000);
  };

  return (
    <div className="bg-[#050505] text-white p-4 rounded-md border border-gray-800">
      <div className="flex justify-around mb-4">
        <button 
          onClick={() => setActiveTab('jobDescription')}
          className={`px-4 py-2 ${activeTab === 'jobDescription' ? 'border-b-2 border-[#B4916C]' : ''}`}
        >
          Job Description
        </button>
        <button 
          onClick={() => setActiveTab('optimizedCV')}
          className={`px-4 py-2 ${activeTab === 'optimizedCV' ? 'border-b-2 border-[#B4916C]' : ''}`}
          disabled={!optimizedCV}
        >
          Optimized CV
        </button>
      </div>
      
      {activeTab === 'jobDescription' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select your CV</label>
            <Select onValueChange={handleCVSelect}>
              <SelectTrigger className="w-full bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select a CV" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {cvs.length === 0 ? (
                  <SelectItem value="no-cvs" disabled>No CVs available</SelectItem>
                ) : (
                  cvs.map((cv, index) => {
                    try {
                      const parts = cv.split('|');
                      return (
                        <SelectItem key={index} value={cv}>
                          {parts[0]}
                        </SelectItem>
                      );
                    } catch (error) {
                      console.error("Error parsing CV:", error);
                      return null;
                    }
                  })
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Description</label>
            <textarea 
              className="w-full p-2 bg-gray-800 text-white border border-gray-700 rounded-md"
              placeholder="Paste your job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
            />
          </div>
          
          <button 
            onClick={handleOptimize}
            disabled={!selectedCVId || !jobDescription || loading}
            className={`mt-2 px-4 py-2 rounded-md w-full ${
              !selectedCVId || !jobDescription || loading 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-[#B4916C] text-black hover:bg-[#a3815b] transition-colors'
            }`}
          >
            {loading ? "Optimizing..." : "Optimize CV for This Job"}
          </button>
          
          {!selectedCVId && (
            <p className="text-sm text-amber-400 mt-2">Please select a CV first</p>
          )}
        </div>
      )}
      
      {activeTab === 'optimizedCV' && (
        <div>
          <h3 className="mb-2 font-bold">Optimized CV Preview</h3>
          {loading ? (
            <p>Loading optimized CV...</p>
          ) : (
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-md whitespace-pre-line">
              {optimizedCV}
            </div>
          )}
          <button
            onClick={() => setActiveTab('jobDescription')}
            className="mt-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Job Description
          </button>
        </div>
      )}
    </div>
  );
} 