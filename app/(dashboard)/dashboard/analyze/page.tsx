import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from "@/components/ui/premium-card";
import Link from "next/link";
import { ArrowLeft, FileText, BarChart2, PieChart, LineChart, List, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import dynamic from "next/dynamic";
import PremiumPageLayout from "@/components/PremiumPageLayout";

// Dynamically import client components
const DocumentAnalyzer: any = dynamic(() => import("@/components/DocumentAnalyzer.client"));
const ErrorRefreshButton: any = dynamic(() => import("@/components/ErrorRefreshButton.client"));

const NewFeaturesBanner = () => (
  <div className="mb-6 bg-gradient-to-r from-[#161616] to-[#111111] border border-[#B4916C]/20 rounded-lg overflow-hidden">
    <div className="p-4 bg-[#B4916C]/10 border-b border-[#B4916C]/20">
      <h3 className="text-lg font-safiro text-[#F9F6EE] flex items-center">
        <svg className="w-5 h-5 mr-2 text-[#B4916C]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        New Features Available
      </h3>
    </div>
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B4916C]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#B4916C]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.995 15.999H12.005M12 6V12M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Enhanced Document Analysis</h4>
            <p className="text-[#C5C2BA] text-sm mt-1">
              We've improved our document analysis system with better support for various file types, 
              enhanced CV analysis, and more detailed insights.
            </p>
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#B4916C]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#B4916C]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12L11 14L15 10M12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12C21 16.971 16.971 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Feedback System</h4>
            <p className="text-[#C5C2BA] text-sm mt-1">
              You can now rate the quality of document analyses and provide feedback to help us continuously improve our system.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-[#222222] flex justify-between items-center">
        <div className="text-[#8A8782] text-sm">
          Check out our new analytics dashboard to see system performance metrics
        </div>
        <Link 
          href="/dashboard/analysis-quality"
          className="px-3 py-1.5 bg-[#B4916C]/20 hover:bg-[#B4916C]/30 text-[#B4916C] text-sm rounded-md transition-colors flex items-center"
        >
          <BarChart2 className="w-4 h-4 mr-1.5" />
          View Analytics
          <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  </div>
);

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
      name: doc.fileName,
      fileName: doc.fileName,
      createdAt: doc.createdAt
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
          <NewFeaturesBanner />
          
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
    console.error("Error in Document Analysis Page:", error);
    
    return (
      <PremiumPageLayout
        title="Document Analysis"
        subtitle="Extract insights and visualize data from your documents"
        backUrl="/dashboard"
        withGradientBackground
        withScrollIndicator
        animation="fade"
      >
        <div className="space-y-6 mb-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading document analysis. Please try again later.
            </AlertDescription>
          </Alert>
          
          <ErrorRefreshButton />
        </div>
      </PremiumPageLayout>
    );
  }
} 