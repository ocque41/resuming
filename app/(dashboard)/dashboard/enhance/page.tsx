import { redirect } from "next/navigation";
import EnhancePageClient from "./EnhancePageClient";
import { Suspense } from "react";

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
    <div className="h-full flex items-center justify-center">
      <p className="text-gray-500">Loading enhance page...</p>
    </div>
  );
}

export default async function EnhancePage() {
  // Instead of using Clerk auth, we'll assume the user is authenticated
  // const { userId } = auth();
  const isAuthenticated = true; // Mock authentication for now

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  // Create mock data that will always work
  const mockData: DocumentData[] = [
    {
      id: "mock1",
      name: "Sample Document 1",
      type: "document",
      createdAt: new Date().toISOString()
    },
    {
      id: "mock2",
      name: "Sample Document 2",
      type: "document",
      createdAt: new Date(Date.now() - 86400000).toISOString() // Yesterday
    },
    {
      id: "mock3",
      name: "Sample CV",
      type: "cv",
      createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    }
  ];

  console.log("Using mock data for development");
  console.log("Mock data:", JSON.stringify(mockData, null, 2));
  
  try {
    return (
      <div className="h-full">
        <Suspense fallback={<EnhancePageFallback />}>
          <EnhancePageClient documentsData={mockData} />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error("Error rendering EnhancePage:", error);
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
        <p className="text-gray-500 mb-4">We're having trouble loading this page.</p>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-w-full">
          {error instanceof Error ? error.message : "Unknown error"}
        </pre>
      </div>
    );
  }
} 