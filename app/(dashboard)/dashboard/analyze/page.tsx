import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from "@/components/ui/premium-card";
import Link from "next/link";
import { ArrowLeft, FileText, BarChart2, PieChart, LineChart, List, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import dynamic from "next/dynamic";
import PremiumPageLayout from "@/components/PremiumPageLayout";

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
    const activityLogs = await getActivityLogs();
    
    // Map documents to the format needed by the client component
    const mappedDocuments = documents.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName,
      createdAt: doc.createdAt.toISOString()
    }));
    
    return (
      <PremiumPageLayout
        title="Document Analysis"
        subtitle="Extract insights and visualize data from your documents"
        backUrl="/dashboard"
        withGradientBackground
        withScrollIndicator
        animation="fade"
        teamData={teamData}
        activityLogs={activityLogs}
      >
        <div className="space-y-6 mb-6">
          <p className="text-[#C5C2BA] font-borna text-lg max-w-3xl">
            Our AI-powered analytics engine extracts meaningful insights from your documents, 
            helping you better understand content, sentiment, and key information.
          </p>
          
          <PremiumCard className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300">
            <PremiumCardHeader>
              <PremiumCardTitle className="font-safiro text-[#F9F6EE]">
                Advanced Document <span className="text-[#B4916C]">Analytics</span>
              </PremiumCardTitle>
              <p className="text-[#8A8782] font-borna mt-1">
                Select a document to analyze and visualize its content
              </p>
            </PremiumCardHeader>
            
            <PremiumCardContent className="p-4 md:p-6">
              {/* Pass documents to client-side component */}
              <DocumentAnalyzer documents={mappedDocuments} />
            </PremiumCardContent>
          </PremiumCard>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <PremiumCard className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300">
              <PremiumCardHeader>
                <div className="flex items-center mb-2">
                  <PieChart className="h-5 w-5 text-[#B4916C] mr-2" />
                  <PremiumCardTitle className="font-safiro text-[#F9F6EE]">Content Breakdown</PremiumCardTitle>
                </div>
                <p className="text-[#8A8782] font-borna text-sm">
                  Visualize the structure and composition of your document
                </p>
              </PremiumCardHeader>
            </PremiumCard>
            
            <PremiumCard className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300">
              <PremiumCardHeader>
                <div className="flex items-center mb-2">
                  <BarChart2 className="h-5 w-5 text-[#B4916C] mr-2" />
                  <PremiumCardTitle className="font-safiro text-[#F9F6EE]">Keyword Analysis</PremiumCardTitle>
                </div>
                <p className="text-[#8A8782] font-borna text-sm">
                  Identify key terms and their frequency in your document
                </p>
              </PremiumCardHeader>
            </PremiumCard>
          </div>
        </div>
      </PremiumPageLayout>
    );
  } catch (error) {
    console.error("Error in DocumentAnalysisPage:", error);
    
    // Return fallback UI
    return (
      <PremiumPageLayout
        title="Document Analysis"
        subtitle="An error occurred while loading your data"
        backUrl="/dashboard"
        withGradientBackground={false}
        animation="fade"
      >
        <div className="mt-6">
          <Alert variant="destructive" className="bg-[#3A1F24] border border-[#E57373]/30 rounded-xl">
            <AlertCircle className="h-5 w-5 text-[#E57373]" />
            <AlertDescription className="text-[#F9F6EE] ml-2 font-borna">
              We encountered an error loading your documents. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
          
          <div className="mt-6 flex justify-center">
            <ErrorRefreshButton />
          </div>
        </div>
      </PremiumPageLayout>
    );
  }
} 