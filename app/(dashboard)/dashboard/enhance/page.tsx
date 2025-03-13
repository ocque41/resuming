import { redirect } from "next/navigation";
import EnhancePageClient from "./EnhancePageClient";

// Define the type for the combined data
interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
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

  // For now, use mock data to get the page working
  console.log("Using mock data for development");
  
  return (
    <div className="h-full">
      <EnhancePageClient documentsData={mockData} />
    </div>
  );
} 