"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Use dynamic import with no SSR to avoid hydration issues
const EnhancePageClient = dynamic(
  () => import("./EnhancePageClient"),
  { ssr: false, loading: () => <EnhancePageFallback /> }
);

// Define the type for the combined data
interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

// Create a fallback component with brand styling
function EnhancePageFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-[#050505] text-white">
      <div className="text-center">
        <div className="w-16 h-16 border-t-4 border-[#B4916C] border-solid rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#B4916C] font-medium">Loading enhance page...</p>
      </div>
    </div>
  );
}

interface ClientWrapperProps {
  documentsData: DocumentData[];
}

export default function ClientWrapper({ documentsData }: ClientWrapperProps) {
  return <EnhancePageClient documentsData={documentsData} />;
} 