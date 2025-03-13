import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";
import { db } from "@/lib/db";
import EnhancePageClient from "./EnhancePageClient";

// Define types for documents and CVs
interface CVType {
  id: string;
  name?: string;
  createdAt: Date;
  userId: string;
}

// Define the type for the combined data
interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

export default async function EnhancePage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Log the structure of the db object to understand what's available
  console.log("DB structure:", typeof db);
  
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