import ClientWrapper from "./ClientWrapper";

// Define the type for the combined data
interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
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
  
  return (
    <div className="h-full">
      <ClientWrapper documentsData={mockData} />
    </div>
  );
} 