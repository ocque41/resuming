import type { Metadata } from 'next';
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getActivityLogs } from "@/lib/db/queries.server";
import { getDocumentById } from "@/lib/document/queries.server";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import { 
  FileText, 
  BarChart2, 
  Download, 
  Edit, 
  Trash2, 
  Share, 
  Calendar, 
  Clock, 
  Info, 
  ArrowLeft 
} from "lucide-react";
import { formatDistance, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import Link from "next/link";
import dynamic from "next/dynamic";
import Scrollable from "@/components/ui/scrollable";

// Dynamically import client components to avoid SSR issues
const DeleteDocument = dynamic(() => import("@/components/delete-document"));

export async function generateMetadata({ 
  params 
}: { 
  params: { id: string } 
}): Promise<Metadata> {
  const document = await getDocumentById(params.id);
  
  if (!document) {
    return {
      title: 'Document Not Found | CVOptimizer',
      description: 'The requested document could not be found.',
    };
  }
  
  return {
    title: `${document.fileName} | CVOptimizer`,
    description: `View and manage your document: ${document.fileName}`,
  };
}

export default async function DocumentDetailPage({ 
  params 
}: {
  params: { id: string }
}) {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  try {
    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      throw new Error("Team not found");
    }
    
    const document = await getDocumentById(params.id);
    if (!document) {
      redirect("/dashboard/documents");
    }
    
    // Check if this document belongs to the current user
    if (document.userId !== parseInt(user.id.toString())) {
      // This document doesn't belong to this user
      redirect("/dashboard/documents");
    }
    
    const documentIdNumber = parseInt(params.id);
    
    const activityLogs = await getActivityLogs();
    
    // Parse metadata
    let metadata: Record<string, any> = {};
    if (document.metadata) {
      try {
        metadata = typeof document.metadata === 'string' 
          ? JSON.parse(document.metadata) 
          : document.metadata;
      } catch (error) {
        console.error("Error parsing metadata:", error);
      }
    }
    
    // Determine file type
    const fileType = getFileTypeFromName(document.fileName);
    
    // Determine if this document is a resume
    const isResume = isResumeDocument(document?.fileName || "", metadata || {});
    
    // Format the date
    const formattedDate = document?.createdAt ? formatDistanceToNow(new Date(document.createdAt), { addSuffix: true }) : null;
    
    // Format upload date
    const uploadDate = new Date(document.createdAt);
    const formattedTime = uploadDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return (
      <PremiumPageLayout
        title={document.fileName}
        subtitle="Document Details"
        backUrl="/dashboard/documents"
        withGradientBackground
        withScrollIndicator={false}
        animation="fade"
        teamData={teamData}
        activityLogs={activityLogs}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main information column */}
          <div className="md:col-span-2 space-y-6">
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${getFileTypeColor(fileType)}`}>
                      {getFileIcon(fileType)}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-safiro text-[#F9F6EE]">{document.fileName}</CardTitle>
                      <CardDescription className="text-[#8A8782] text-sm font-borna">
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3.5 w-3.5 mr-0.5" />
                          <span>Uploaded {formattedDate}</span>
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <DownloadButton fileName={document.fileName} />
                    
                    {isResume ? (
                      <>
                        <Link href={`/dashboard/optimize?documentId=${params.id}`}>
                          <Button variant="outline" size="sm" className="border-[#222222] hover:bg-[#161616]">
                            <BarChart2 className="h-4 w-4 mr-1.5" />
                            Optimize
                          </Button>
                        </Link>
                        <Link href={`/dashboard/enhance?documentId=${params.id}`}>
                          <Button variant="outline" size="sm" className="border-[#222222] hover:bg-[#161616]">
                            <Edit className="h-4 w-4 mr-1.5" />
                            Edit
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link href={`/dashboard/document-analyzer?documentId=${params.id}`}>
                        <Button variant="outline" size="sm" className="border-[#222222] hover:bg-[#161616]">
                          <BarChart2 className="h-4 w-4 mr-1.5" />
                          Analyze
                        </Button>
                      </Link>
                    )}
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="bg-[#3A1F24] hover:bg-[#4A2F34] border-[#E57373]/20 text-[#E57373]">
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          Delete
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#080808] border-gray-800 text-[#F9F6EE]">
                        <DialogHeader>
                          <DialogTitle className="text-[#F9F6EE] font-safiro">Delete Document</DialogTitle>
                          <DialogDescription className="text-[#8A8782]">
                            Are you sure you want to delete this document? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                          <DeleteDocument documentId={documentIdNumber} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              
              <Tabs defaultValue="details" className="px-6 pb-6">
                <TabsList className="bg-[#080808] border border-[#222222] mb-4">
                  <TabsTrigger value="details" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="metadata" className="data-[state=active]:bg-[#161616] data-[state=active]:text-[#F9F6EE]">
                    Metadata
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="details">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm text-[#8A8782] font-medium mb-1">File Info</h4>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-[#8A8782] text-sm">Type</span>
                            <span className="text-[#F9F6EE] font-borna">
                              {fileType ? fileType.toUpperCase() : 'Unknown'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8782] text-sm">Document ID</span>
                            <span className="text-[#F9F6EE] font-borna">{document.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8782] text-sm">Document Type</span>
                            <Badge className={`${isResume ? 'bg-[#0D1F15] text-[#4ADE80]' : 'bg-[#161616] text-[#8A8782]'}`}>
                              {isResume ? 'Resume/CV' : 'Document'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {metadata?.fileSize && (
                        <div>
                          <h4 className="text-sm text-[#8A8782] font-medium mb-1">File Size</h4>
                          <p className="text-[#F9F6EE] font-borna">
                            {formatFileSize(metadata.fileSize)}
                          </p>
                        </div>
                      )}
                      
                      {document.filepath && (
                        <div>
                          <h4 className="text-sm text-[#8A8782] font-medium mb-1">Storage Location</h4>
                          <p className="text-[#F9F6EE] font-borna text-sm truncate">
                            {document.filepath.includes('dropbox.com') ? 'Dropbox Storage' : 'Local Storage'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm text-[#8A8782] font-medium mb-1">Upload Information</h4>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-[#8A8782] text-sm">Date</span>
                            <span className="text-[#F9F6EE] font-borna">{formattedDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8782] text-sm">Time</span>
                            <span className="text-[#F9F6EE] font-borna">{formattedTime}</span>
                          </div>
                        </div>
                      </div>
                      
                      {isResume && (
                        <div>
                          <h4 className="text-sm text-[#8A8782] font-medium mb-1">Optimization Status</h4>
                          <div className="flex items-center">
                            <Badge className={metadata?.optimized ? 'bg-[#0D1F15] text-[#4ADE80]' : 'bg-[#161616] text-[#8A8782]'}>
                              {metadata?.optimized ? 'Optimized' : 'Not Optimized'}
                            </Badge>
                            
                            {!metadata?.optimized && (
                              <Link href={`/dashboard/optimize?documentId=${params.id}`} className="ml-2">
                                <Button variant="link" size="sm" className="h-auto p-0 text-[#B4916C]">
                                  Optimize Now
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Add document text preview if available */}
                  {document.rawText && (
                    <div className="mt-4">
                      <h2 className="text-lg font-medium text-[#F9F6EE] mb-2 font-safiro">Document Text</h2>
                      <Scrollable 
                        className="bg-[#080808] border border-[#222222] rounded-lg p-4" 
                        maxHeight="16rem"
                        variant="modern"
                      >
                        <p className="text-[#E2DFD7] whitespace-pre-wrap text-sm">
                          {document.rawText}
                        </p>
                      </Scrollable>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="metadata">
                  <div className="bg-[#080808] border border-[#222222] rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-[#222222]">
                      <h4 className="text-[#F9F6EE] font-safiro">Document Metadata</h4>
                      <p className="text-sm text-[#8A8782]">
                        Technical metadata and properties extracted from this document.
                      </p>
                    </div>
                    <div className="p-2">
                      {Object.keys(metadata).length === 0 ? (
                        <div className="p-4 text-center">
                          <Info className="h-10 w-10 text-[#333333] mx-auto mb-2" />
                          <p className="text-[#8A8782]">No metadata available for this document.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#161616]">
                          {Object.entries(metadata).map(([key, value], index) => {
                            // Skip rendering complex nested objects or arrays directly
                            const isComplex = value !== null && 
                              typeof value === 'object' && 
                              !Array.isArray(value);
                            
                            const displayValue = isComplex 
                              ? '[Complex Object]' 
                              : Array.isArray(value) 
                                ? `[${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}]`
                                : String(value);
                            
                            return (
                              <div key={index} className="px-4 py-3 flex justify-between items-center">
                                <span className="text-[#B4916C] font-medium text-sm">{key}</span>
                                <span className="text-[#F9F6EE] font-borna text-sm max-w-[60%] truncate">
                                  {displayValue}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
          
          {/* Sidebar column */}
          <div className="space-y-6">
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg font-safiro text-[#F9F6EE]">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                <Link href={isResume ? `/dashboard/optimize?documentId=${params.id}` : `/dashboard/document-analyzer?documentId=${params.id}`}>
                  <Button className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white justify-start mb-2">
                    {isResume ? (
                      <>
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Optimize for ATS
                      </>
                    ) : (
                      <>
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Analyze Document
                      </>
                    )}
                  </Button>
                </Link>
                
                <Link href={`/dashboard/enhance?documentId=${params.id}`}>
                  <Button variant="outline" className="w-full border-[#222222] hover:bg-[#161616] justify-start">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit with AI
                  </Button>
                </Link>
                
                <DownloadButton fileName={document.fileName} variant="outline" className="w-full mt-2" />
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-[#222222] hover:bg-[#161616] justify-start mt-2">
                      <Share className="h-4 w-4 mr-2" />
                      Share Document
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#111111] border border-[#222222]">
                    <DialogHeader>
                      <DialogTitle className="text-[#F9F6EE] font-safiro">Share Document</DialogTitle>
                      <DialogDescription className="text-[#8A8782]">
                        This feature is coming soon! You'll be able to share documents with team members.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end">
                      <Button variant="outline" className="border-[#222222] hover:bg-[#161616]">
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
            
            <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg font-safiro text-[#F9F6EE]">Related</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-col space-y-2">
                  <Link href="/dashboard/documents" className="text-[#B4916C] hover:underline flex items-center">
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    Back to Document Hub
                  </Link>
                  
                  {isResume && (
                    <>
                      <Link href="/dashboard/jobs" className="text-[#B4916C] hover:underline">
                        Find matching jobs
                      </Link>
                      <Link href="/job-match" className="text-[#B4916C] hover:underline">
                        Match to job descriptions
                      </Link>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PremiumPageLayout>
    );
  } catch (error) {
    console.error("Error in DocumentDetailPage:", error);
    
    // Return fallback UI for errors
    return (
      <PremiumPageLayout
        title="Document Details"
        subtitle="An error occurred while loading document details"
        backUrl="/dashboard/documents"
        withGradientBackground={false}
        animation="fade"
      >
        <div className="p-6 bg-[#3A1F24] border border-[#E57373]/30 rounded-xl mt-6">
          <h3 className="text-[#E57373] font-safiro mb-2">Error Loading Document</h3>
          <p className="text-[#F9F6EE] font-borna">
            We encountered an error while loading document details. Please try refreshing the page or contact support.
          </p>
          <Button className="mt-4 bg-[#B4916C] hover:bg-[#A3815C] text-white" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </PremiumPageLayout>
    );
  }
}

// Client component for the download button
function DownloadButton({ fileName, variant = "default", className = "" }: { 
  fileName: string; 
  variant?: "default" | "outline"; 
  className?: string;
}) {
  return (
    <form action={`/api/download-cv?fileName=${encodeURIComponent(fileName)}`} method="get">
      <Button 
        type="submit" 
        variant={variant} 
        className={`${className} ${variant === "outline" ? "border-[#222222] hover:bg-[#161616]" : ""}`}
      >
        <Download className="h-4 w-4 mr-1.5" />
        Download
      </Button>
    </form>
  );
}

// Helper functions
function getFileTypeFromName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return extension;
}

function getFileIcon(fileType: string) {
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
      return <FileText className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
}

function getFileTypeColor(fileType: string): string {
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
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function isResumeDocument(fileName: string, metadata: any): boolean {
  const hasResumeKeyword = fileName.toLowerCase().includes('resume') || 
                          fileName.toLowerCase().includes('cv');
  const isResumeMetadata = metadata?.docType === 'resume' || metadata?.docType === 'cv';
  return hasResumeKeyword || isResumeMetadata;
} 