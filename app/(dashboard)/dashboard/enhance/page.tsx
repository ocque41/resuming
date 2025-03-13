import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense } from "react";

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

// Create a simple error component
function ErrorDisplay({ error }: { error: Error }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#050505] text-white p-4">
      <h2 className="text-xl font-bold mb-4 text-[#B4916C]">Something went wrong</h2>
      <p className="text-gray-400 mb-4">We're having trouble loading this page.</p>
      <pre className="bg-[#1A1A1A] p-4 rounded text-sm overflow-auto max-w-full border border-[#2D2D2D]">
        {error.message}
      </pre>
    </div>
  );
}

export default function EnhancePage() {
  return (
    <div className="h-full bg-[#050505] text-white p-4">
      <h1 className="text-2xl font-bold mb-4 text-[#B4916C]">Enhance Documents</h1>
      <p>This is a static page with no client components.</p>
    </div>
  );
} 