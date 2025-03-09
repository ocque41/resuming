import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, FileText, BarChart2, PieChart, LineChart, List, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import dynamic from "next/dynamic";

// Dynamically import client components
const DocumentAnalyzer = dynamic(() => import("@/components/DocumentAnalyzer.client"));
const ErrorRefreshButton = dynamic(() => import("@/components/ErrorRefreshButton.client"));

export default async function DocumentAnalysisPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  try {
    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      throw new Error("Team not found");
    }
    
    const documents = await getCVsForUser(user.id);
    
    // Map documents to the format needed by the client component
    const mappedDocuments = documents.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName,
      createdAt: doc.createdAt
    }));
    
    return (
      <>
        <header className="flex items-center justify-between p-4 mx-auto max-w-7xl">
          <div className="flex items-center">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg lg:text-xl font-medium text-white">
              Document Analysis
            </h1>
          </div>
        </header>
        
        <div className="flex flex-col space-y-6 mx-auto max-w-7xl px-4 pb-12">
          <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-[#B4916C]">Advanced Document Analytics</CardTitle>
              <CardDescription className="text-gray-400">
                Extract insights and visualize data from your documents
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-4 md:p-6">
              <p className="mb-6 text-gray-300">
                Our AI-powered analytics engine extracts meaningful insights from your documents, 
                helping you better understand content, sentiment, and key information.
              </p>
              
              {/* Pass documents to client-side component */}
              <DocumentAnalyzer documents={mappedDocuments} />
            </CardContent>
          </Card>
        </div>
      </>
    );
  } catch (error) {
    console.error("Error in DocumentAnalysisPage:", error);
    
    // Return fallback UI
    return (
      <>
        <header className="flex items-center justify-between p-4 mx-auto max-w-7xl">
          <div className="flex items-center">
            <Link 
              href="/dashboard" 
              className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg lg:text-xl font-medium text-white">
              Document Analysis
            </h1>
          </div>
        </header>
        
        <div className="flex flex-col space-y-6 mx-auto max-w-7xl px-4 pb-12">
          <Alert variant="destructive" className="bg-red-900/20 border-red-900/30">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              We encountered an error loading your documents. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
          
          <ErrorRefreshButton />
        </div>
      </>
    );
  }
} 