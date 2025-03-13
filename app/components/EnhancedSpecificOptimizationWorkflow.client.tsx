/* use client */
'use client';

import React, { useState } from 'react';

export default function EnhancedSpecificOptimizationWorkflow() {
  const [activeTab, setActiveTab] = useState('jobDescription');
  const [jobDescription, setJobDescription] = useState('');
  const [optimizedCV, setOptimizedCV] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOptimize = () => {
    setLoading(true);
    // Simulate an asynchronous API call for CV optimization
    setTimeout(() => {
      const result = `Optimized CV tailored for the job: ${jobDescription}`;
      setOptimizedCV(result);
      setLoading(false);
      setActiveTab('optimizedCV');
    }, 2000);
  };

  return (
    <div className="bg-[#050505] text-white p-4 rounded-md">
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
        <div>
          <textarea 
            className="w-full p-2 bg-gray-800 text-white"
            placeholder="Paste your job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={6}
          />
          <button 
            onClick={handleOptimize}
            disabled={!jobDescription || loading}
            className="mt-2 px-4 py-2 bg-[#B4916C] text-black rounded-md"
          >
            {loading ? "Optimizing..." : "Optimize"}
          </button>
        </div>
      )}
      {activeTab === 'optimizedCV' && (
        <div>
          <h3 className="mb-2 font-bold">Optimized CV Preview</h3>
          {loading ? (
            <p>Loading optimized CV...</p>
          ) : (
            <div className="p-2 bg-gray-800">{optimizedCV}</div>
          )}
        </div>
      )}
    </div>
  );
} 