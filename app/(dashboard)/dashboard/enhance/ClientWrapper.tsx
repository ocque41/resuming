"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Use dynamic import with no SSR to avoid hydration issues
const EnhancePageClient = dynamic(
  () => import("./EnhancePageClient"),
  { ssr: false }
);

// Define the type for the combined data
interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

// Create a fallback component
function EnhancePageFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-[#050505] text-white">
      <p className="text-[#B4916C]">Loading enhance page...</p>
    </div>
  );
}

interface ClientWrapperProps {
  documentsData: DocumentData[];
}

export default function ClientWrapper({ documentsData }: ClientWrapperProps) {
  return (
    <Suspense fallback={<EnhancePageFallback />}>
      <EnhancePageClient documentsData={documentsData} />
    </Suspense>
  );
} 