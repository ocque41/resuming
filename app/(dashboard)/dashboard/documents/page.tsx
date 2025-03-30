import type { Metadata } from 'next';
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { 
  FileText, 
  BarChart2, 
  PieChart, 
  Upload, 
  Search, 
  Clock, 
  Filter, 
  ArrowRight 
} from "lucide-react";
import Link from "next/link";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { PremiumCard, PremiumCardContent, PremiumCardFooter, PremiumCardHeader, PremiumCardTitle } from "@/components/ui/premium-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamically import client components
const CVUploader = dynamic(() => import("@/components/CVUploader.client"));

export const metadata: Metadata = {
  title: 'Document Hub | CVOptimizer',
  description: 'Manage, analyze, and optimize all your documents in one centralized hub.',
};

// Format date function
function formatDate(dateString: string) {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

export default async function DocumentsDashboardPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  try {
    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      throw new Error("Team not found");
    }
    
    // Get user's documents
    const documents = await getCVsForUser(user.id);
    const activityLogs = await getActivityLogs();
    
    // Prepare documents for display
    const mappedDocuments = documents.map(doc => ({
      id: doc.id.toString(),
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      filePath: doc.filepath,
      fileType: getFileTypeFromName(doc.fileName),
      metadata: doc.metadata ? (
        typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata
      ) : {}
    }));
    
    // Group documents by type
    const resumeDocuments = mappedDocuments.filter(doc => 
      isResumeDocument(doc.fileName, doc.metadata)
    );
    
    const otherDocuments = mappedDocuments.filter(doc => 
      !isResumeDocument(doc.fileName, doc.metadata)
    );
    
    return (
      <PremiumPageLayout
        title="Document Hub"
        subtitle="Manage, analyze, and optimize all your documents"
        backUrl="/dashboard"
        withGradientBackground
        withScrollIndicator
        animation="fade"
        teamData={teamData}
        activityLogs={activityLogs}
      >
        <Tabs defaultValue="all" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="bg-[#111111] border border-[#222222]">
              <TabsTrigger value="all" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                All Documents
              </TabsTrigger>
              <TabsTrigger value="resumes" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                Resumes & CVs
              </TabsTrigger>
              <TabsTrigger value="other" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                Other Documents
              </TabsTrigger>
            </TabsList>
            
            <div className="flex space-x-2">
              <Button variant="outline" className="border-[#222222] bg-[#111111] hover:bg-[#161616]">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="accent" className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </div>
          
          <TabsContent value="all" className="mt-0">
            <div className="mb-8">
              <h3 className="text-xl text-[#F9F6EE] font-safiro mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/document-analyzer">
                  <PremiumCard className="hover:border-[#333333] transition-all duration-300 h-full cursor-pointer group">
                    <PremiumCardHeader>
                      <div className="flex items-center mb-2">
                        <div className="bg-[#0D1F15] w-9 h-9 rounded-lg flex items-center justify-center mr-3">
                          <PieChart className="h-5 w-5 text-[#4ADE80]" />
                        </div>
                        <PremiumCardTitle className="font-safiro text-[#F9F6EE] text-lg group-hover:text-[#B4916C] transition-colors">
                          Document Analysis
                        </PremiumCardTitle>
                      </div>
                    </PremiumCardHeader>
                    <PremiumCardContent>
                      <p className="text-[#8A8782] text-sm font-borna">
                        Get deep insights into your documents using AI. Analyze content, structure, and recommendations.
                      </p>
                    </PremiumCardContent>
                    <PremiumCardFooter className="flex justify-end">
                      <ArrowRight className="h-5 w-5 text-[#B4916C] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </PremiumCardFooter>
                  </PremiumCard>
                </Link>
                
                <Link href="/dashboard/optimize">
                  <PremiumCard className="hover:border-[#333333] transition-all duration-300 h-full cursor-pointer group">
                    <PremiumCardHeader>
                      <div className="flex items-center mb-2">
                        <div className="bg-[#382917] w-9 h-9 rounded-lg flex items-center justify-center mr-3">
                          <BarChart2 className="h-5 w-5 text-[#FFB74D]" />
                        </div>
                        <PremiumCardTitle className="font-safiro text-[#F9F6EE] text-lg group-hover:text-[#B4916C] transition-colors">
                          CV Optimization
                        </PremiumCardTitle>
                      </div>
                    </PremiumCardHeader>
                    <PremiumCardContent>
                      <p className="text-[#8A8782] text-sm font-borna">
                        Optimize your resume for ATS systems and improve your chances of landing interviews.
                      </p>
                    </PremiumCardContent>
                    <PremiumCardFooter className="flex justify-end">
                      <ArrowRight className="h-5 w-5 text-[#B4916C] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </PremiumCardFooter>
                  </PremiumCard>
                </Link>
                
                <Link href="/dashboard/enhance">
                  <PremiumCard className="hover:border-[#333333] transition-all duration-300 h-full cursor-pointer group">
                    <PremiumCardHeader>
                      <div className="flex items-center mb-2">
                        <div className="bg-[#1A1F2A] w-9 h-9 rounded-lg flex items-center justify-center mr-3">
                          <FileText className="h-5 w-5 text-[#64B5F6]" />
                        </div>
                        <PremiumCardTitle className="font-safiro text-[#F9F6EE] text-lg group-hover:text-[#B4916C] transition-colors">
                          Document Editor
                        </PremiumCardTitle>
                      </div>
                    </PremiumCardHeader>
                    <PremiumCardContent>
                      <p className="text-[#8A8782] text-sm font-borna">
                        Edit your documents with AI assistance. Improve content, fix grammar, and enhance readability.
                      </p>
                    </PremiumCardContent>
                    <PremiumCardFooter className="flex justify-end">
                      <ArrowRight className="h-5 w-5 text-[#B4916C] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </PremiumCardFooter>
                  </PremiumCard>
                </Link>
              </div>
            </div>
            
            <h3 className="text-xl text-[#F9F6EE] font-safiro mb-4">Upload New Document</h3>
            <CVUploader />
            
            <h3 className="text-xl text-[#F9F6EE] font-safiro mt-8 mb-4">Recently Uploaded Documents</h3>
            <div className="grid grid-cols-1 gap-4">
              {mappedDocuments.length === 0 ? (
                <PremiumCard className="border border-[#222222] bg-[#111111]">
                  <PremiumCardContent className="p-6 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-[#161616] flex items-center justify-center mb-3">
                      <FileText className="h-6 w-6 text-[#8A8782]" />
                    </div>
                    <h4 className="text-[#F9F6EE] font-safiro mb-2">No documents yet</h4>
                    <p className="text-[#8A8782] text-sm font-borna">
                      Upload your first document using the uploader above.
                    </p>
                  </PremiumCardContent>
                </PremiumCard>
              ) : (
                mappedDocuments.slice(0, 5).map((doc) => (
                  <DocumentRow key={doc.id} document={doc} />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="resumes" className="mt-0">
            <h3 className="text-xl text-[#F9F6EE] font-safiro mb-4">Resume & CV Documents</h3>
            {resumeDocuments.length === 0 ? (
              <PremiumCard className="border border-[#222222] bg-[#111111]">
                <PremiumCardContent className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-[#161616] flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 text-[#8A8782]" />
                  </div>
                  <h4 className="text-[#F9F6EE] font-safiro mb-2">No resume documents found</h4>
                  <p className="text-[#8A8782] text-sm font-borna">
                    Upload your resume or CV using the uploader to get started.
                  </p>
                </PremiumCardContent>
              </PremiumCard>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {resumeDocuments.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} isResume={true} />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="other" className="mt-0">
            <h3 className="text-xl text-[#F9F6EE] font-safiro mb-4">Other Documents</h3>
            {otherDocuments.length === 0 ? (
              <PremiumCard className="border border-[#222222] bg-[#111111]">
                <PremiumCardContent className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-[#161616] flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 text-[#8A8782]" />
                  </div>
                  <h4 className="text-[#F9F6EE] font-safiro mb-2">No other documents found</h4>
                  <p className="text-[#8A8782] text-sm font-borna">
                    Upload non-resume documents to see them here.
                  </p>
                </PremiumCardContent>
              </PremiumCard>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {otherDocuments.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PremiumPageLayout>
    );
  } catch (error) {
    console.error("Error in DocumentsDashboardPage:", error);
    
    // Return fallback UI for errors
    return (
      <PremiumPageLayout
        title="Document Hub"
        subtitle="An error occurred while loading your documents"
        backUrl="/dashboard"
        withGradientBackground={false}
        animation="fade"
      >
        <div className="p-6 bg-[#3A1F24] border border-[#E57373]/30 rounded-xl mt-6">
          <h3 className="text-[#E57373] font-safiro mb-2">Error Loading Documents</h3>
          <p className="text-[#F9F6EE] font-borna">
            We encountered an error while loading your documents. Please try refreshing the page or contact support.
          </p>
          <Button className="mt-4 bg-[#B4916C] hover:bg-[#A3815C] text-white" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </PremiumPageLayout>
    );
  }
}

// Helper component for document rows
function DocumentRow({ document, isResume = false }: { document: any, isResume?: boolean }) {
  const fileType = getFileTypeFromName(document.fileName);
  
  const getFileIcon = () => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-5 w-5" />;
      case 'docx':
      case 'doc':
        return <FileText className="h-5 w-5" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <BarChart2 className="h-5 w-5" />;
      case 'pptx':
      case 'ppt':
        return <PieChart className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };
  
  const getFileTypeColor = () => {
    switch (fileType) {
      case 'pdf':
        return 'bg-[#382917] text-[#FFB74D]';
      case 'docx':
      case 'doc':
        return 'bg-[#1A1F2A] text-[#64B5F6]';
      case 'xlsx':
      case 'xls':
      case 'csv':
        return 'bg-[#0D1F15] text-[#4ADE80]';
      case 'pptx':
      case 'ppt':
        return 'bg-[#3A1F24] text-[#E57373]';
      default:
        return 'bg-[#161616] text-[#8A8782]';
    }
  };
  
  // Check if the document is optimized
  const isOptimized = document.metadata?.optimized || false;
  
  return (
    <PremiumCard className="border border-[#222222] bg-[#111111] hover:border-[#333333] transition-all duration-300">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${getFileTypeColor()}`}>
            {getFileIcon()}
          </div>
          <div>
            <h4 className="text-[#F9F6EE] font-safiro">{document.fileName}</h4>
            <div className="flex items-center mt-1">
              <Clock className="h-3.5 w-3.5 text-[#8A8782] mr-1.5" />
              <span className="text-xs text-[#8A8782] font-borna">{formatDate(document.createdAt)}</span>
              
              {fileType && (
                <>
                  <span className="mx-2 text-[#333333]">•</span>
                  <Badge variant="outline" className="text-xs bg-[#161616] text-[#8A8782] border-[#222222]">
                    {fileType.toUpperCase()}
                  </Badge>
                </>
              )}
              
              {isResume && isOptimized && (
                <>
                  <span className="mx-2 text-[#333333]">•</span>
                  <Badge className="text-xs bg-[#0D1F15] text-[#4ADE80] border-[#1A4332]">
                    Optimized
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {isResume ? (
            <>
              <Link href={`/dashboard/optimize?documentId=${document.id}`}>
                <Button variant="outline" size="sm" className="border-[#222222] hover:bg-[#161616]">
                  <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                  Optimize
                </Button>
              </Link>
              <Link href={`/dashboard/enhance?documentId=${document.id}`}>
                <Button variant="outline" size="sm" className="border-[#222222] hover:bg-[#161616]">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </Link>
            </>
          ) : (
            <Link href={`/dashboard/document-analyzer?documentId=${document.id}`}>
              <Button variant="outline" size="sm" className="border-[#222222] hover:bg-[#161616]">
                <PieChart className="h-3.5 w-3.5 mr-1.5" />
                Analyze
              </Button>
            </Link>
          )}
          <Link href={`/dashboard/documents/${document.id}`}>
            <Button variant="accent" size="sm" className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              View Details
            </Button>
          </Link>
        </div>
      </div>
    </PremiumCard>
  );
}

// Helper functions
function getFileTypeFromName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return extension;
}

function isResumeDocument(fileName: string, metadata: any): boolean {
  const lowerFileName = fileName.toLowerCase();
  const fileType = getFileTypeFromName(fileName);
  
  // Check if the filename contains resume-related keywords
  const resumeKeywords = ['resume', 'cv', 'curriculum'];
  const hasResumeKeyword = resumeKeywords.some(keyword => lowerFileName.includes(keyword));
  
  // Check if the metadata indicates this is a resume
  const isResumeMetadata = metadata?.documentType === 'resume' || 
                           metadata?.isResume === true ||
                           metadata?.type === 'resume';
  
  return hasResumeKeyword || isResumeMetadata;
} 