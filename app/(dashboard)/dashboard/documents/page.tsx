import { redirect } from "next/navigation";
import { getUser, getTeamForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Mail, Upload, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default async function DocumentEditorPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  return (
    <>
      <header className="flex items-center justify-between p-4 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-5xl">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg lg:text-xl font-medium text-white">
            Document Editor
          </h1>
        </div>
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-5xl px-2 sm:px-4 md:px-6 pb-12">
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#B4916C]">AI-Powered Document Editor</CardTitle>
            <CardDescription className="text-gray-400">
              Edit, enhance, and transform any type of document with AI assistance
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-4 md:p-6">
            <p className="mb-6 text-gray-300">
              Upload any document or paste text directly to edit with AI. 
              Our tool can help you improve, reformat, translate, or completely transform your content.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Document Upload Area */}
              <Card className="border border-[#B4916C]/20 bg-black/30 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-[#B4916C] text-lg flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-[#B4916C]/50 hover:bg-black/30 transition-colors">
                    <FileText className="h-10 w-10 text-[#B4916C] mx-auto mb-4" />
                    <p className="text-base font-medium text-white mb-2">
                      Drag & drop your document here
                    </p>
                    <p className="text-sm text-gray-400 mb-4">or click to browse files</p>
                    <p className="text-xs text-gray-500">
                      Supported formats: PDF, DOCX, TXT, XLSX, PPTX, and more
                    </p>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-400 mb-2">Coming soon: Enhanced document processing</p>
                  </div>
                </CardContent>
              </Card>
              
              {/* AI Chat Area */}
              <Card className="border border-[#B4916C]/20 bg-black/30 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-[#B4916C] text-lg flex items-center">
                    <Mail className="h-5 w-5 mr-2" />
                    AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-black/50 rounded-lg p-4 h-64 overflow-y-auto mb-4 border border-gray-800">
                    <div className="flex items-start mb-4">
                      <div className="bg-[#B4916C]/20 rounded-lg p-3 text-gray-300 max-w-[80%]">
                        <p className="text-sm">Hello! I can help you edit and improve your documents. Upload a file or paste some text to get started.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <Textarea 
                      placeholder="Type your instructions here... (e.g., 'Reformat this document as a business proposal')"
                      className="resize-none min-h-[100px] bg-black/50 border-gray-700 text-gray-300"
                    />
                    <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white h-10 px-4">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-800">
              <h3 className="text-[#B4916C] font-medium mb-4">What You Can Do With Our Document Editor</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Format Conversion</h4>
                  <p className="text-sm text-gray-400">Convert between document formats while preserving styling and content.</p>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Content Enhancement</h4>
                  <p className="text-sm text-gray-400">Improve writing style, clarity, and professionalism of your documents.</p>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Translation</h4>
                  <p className="text-sm text-gray-400">Translate documents between multiple languages while maintaining context.</p>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Template Application</h4>
                  <p className="text-sm text-gray-400">Apply professional templates to transform plain documents.</p>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Data Extraction</h4>
                  <p className="text-sm text-gray-400">Extract key information from complex documents into structured formats.</p>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Summarization</h4>
                  <p className="text-sm text-gray-400">Generate concise summaries of lengthy documents while preserving key points.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 