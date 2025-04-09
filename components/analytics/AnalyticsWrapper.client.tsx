"use client";

import dynamic from "next/dynamic";

// Dynamically import the visualizer component with loading state
const AnalyticsVisualizer = dynamic(() => import("./AnalyticsVisualizer.client"), {
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-64 bg-[#111111] border border-[#222222] rounded-md">
      <div className="w-8 h-8 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin mb-2"></div>
      <p className="text-[#F9F6EE]">Loading analytics...</p>
    </div>
  ),
  ssr: false
});

// Simple client component wrapper for the analytics visualizer
export default function AnalyticsWrapper() {
  return <AnalyticsVisualizer />;
} 