import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, FileText, Mail, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

// Dynamically import client components
const DocumentUploader = dynamic(() => import("@/components/DocumentUploader.client"));

export default async function DocumentEditorPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  const documents = await getCVsForUser(user.id);
  
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
            Document Editor
          </h1>
        </div>
        
        <Link 
          href="/dashboard/settings"
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <Settings className="h-4 w-4 mr-1" />
          <span>AI Preferences</span>
        </Link>
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-7xl px-4 pb-12">
        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="bg-black border border-gray-800 mb-6">
            <TabsTrigger value="editor" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Editor
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              AI Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="editor" className="mt-0">
            <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-[#B4916C]">AI-Powered Document Editor</CardTitle>
                <CardDescription className="text-gray-400">
                  Edit, enhance, and transform any type of document with AI assistance
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left sidebar - Document selection & upload */}
                  <div className="lg:col-span-1 space-y-6">
                    <Card className="border border-[#B4916C]/20 bg-black/30 shadow-lg">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-[#B4916C] text-lg">Your Documents</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* Document list would go here */}
                        <div className="border border-gray-800 rounded-md p-3 text-gray-400 text-sm mb-2">
                          <p className="text-white mb-1">Sample Resume.pdf</p>
                          <p className="text-xs">Uploaded 2 days ago</p>
                        </div>
                        
                        <div className="border border-gray-800 rounded-md p-3 text-gray-400 text-sm mb-2">
                          <p className="text-white mb-1">Project Proposal.docx</p>
                          <p className="text-xs">Uploaded 5 days ago</p>
                        </div>
                        
                        <div className="border border-gray-800 rounded-md p-3 text-gray-400 text-sm">
                          <p className="text-white mb-1">Meeting Notes.txt</p>
                          <p className="text-xs">Uploaded 1 week ago</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <DocumentUploader 
                      allowedTypes={['pdf', 'docx', 'txt', 'rtf', 'xlsx', 'pptx', 'jpg', 'png']}
                      maxSizeMB={10}
                      showPreview={true}
                    />
                  </div>
                  
                  {/* Main chat interface */}
                  <div className="lg:col-span-2">
                    <Card className="border border-[#B4916C]/20 bg-black/30 shadow-lg h-full">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-[#B4916C] text-lg flex items-center">
                            <FileText className="h-5 w-5 mr-2" />
                            Document AI Chat
                          </CardTitle>
                          <CardDescription className="text-gray-500">
                            Chat with AI about your document
                          </CardDescription>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <select 
                            className="bg-black border border-gray-700 text-gray-300 rounded-md text-sm px-3 py-1.5"
                            defaultValue=""
                          >
                            <option value="" disabled>Select document</option>
                            <option value="sample-resume">Sample Resume.pdf</option>
                            <option value="project-proposal">Project Proposal.docx</option>
                            <option value="meeting-notes">Meeting Notes.txt</option>
                          </select>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-4">
                        <div className="bg-black/50 rounded-lg p-4 h-[500px] overflow-y-auto mb-4 border border-gray-800 space-y-6">
                          {/* AI message */}
                          <div className="flex items-start">
                            <div className="h-8 w-8 rounded-full bg-[#B4916C]/20 flex items-center justify-center text-[#B4916C] mr-3 mt-1">
                              AI
                            </div>
                            <div className="bg-[#B4916C]/10 rounded-lg p-3 text-gray-300 max-w-[80%]">
                              <p className="text-sm">
                                Hello! I'm your document assistant. Select a document or upload a new one, 
                                and I can help you edit, format, summarize, or transform it. What would you like to do today?
                              </p>
                            </div>
                          </div>
                          
                          {/* User message */}
                          <div className="flex items-start justify-end">
                            <div className="bg-gray-800 rounded-lg p-3 text-gray-300 max-w-[80%]">
                              <p className="text-sm">Can you help me optimize my resume for a software engineering position?</p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-white ml-3 mt-1">
                              You
                            </div>
                          </div>
                          
                          {/* AI response with document suggestion */}
                          <div className="flex items-start">
                            <div className="h-8 w-8 rounded-full bg-[#B4916C]/20 flex items-center justify-center text-[#B4916C] mr-3 mt-1">
                              AI
                            </div>
                            <div className="bg-[#B4916C]/10 rounded-lg p-3 text-gray-300 max-w-[80%]">
                              <p className="text-sm mb-3">
                                I'd be happy to help you optimize your resume! Please select your resume from your documents 
                                or upload it if you haven't already. Once your document is ready, I can:
                              </p>
                              <ul className="list-disc text-sm pl-5 space-y-1.5">
                                <li>Highlight your relevant technical skills</li>
                                <li>Improve the wording of your achievements</li>
                                <li>Suggest a better structure for your experience section</li>
                                <li>Tailor it to match software engineering job descriptions</li>
                                <li>Fix any formatting inconsistencies</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-end gap-2">
                          <Textarea 
                            placeholder="Type your message... (e.g., 'Format this document as a business proposal')"
                            className="resize-none min-h-[80px] bg-black/50 border-gray-700 text-gray-300"
                          />
                          <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white h-10 px-4">
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-0">
            <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-[#B4916C]">AI Settings & Preferences</CardTitle>
                <CardDescription className="text-gray-400">
                  Customize how the AI assistant processes your documents
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-black/30 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-[#B4916C] font-medium mb-3">AI Persona</h3>
                    <select className="w-full bg-black border border-gray-700 text-gray-300 rounded-md px-3 py-2 mb-2">
                      <option value="professional">Professional (Default)</option>
                      <option value="creative">Creative</option>
                      <option value="academic">Academic</option>
                      <option value="technical">Technical</option>
                      <option value="simple">Simple & Concise</option>
                    </select>
                    <p className="text-sm text-gray-500">Select how you want the AI to communicate with you</p>
                  </div>
                  
                  <div className="bg-black/30 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-[#B4916C] font-medium mb-3">Document Processing Instructions</h3>
                    <Textarea 
                      className="min-h-[150px] bg-black/50 border-gray-700 text-gray-300 mb-2"
                      placeholder="Enter custom instructions for how the AI should process your documents..."
                      defaultValue="Focus on clarity and conciseness. Remove unnecessary jargon. Highlight key information with bullet points when appropriate. Use professional language."
                    />
                    <p className="text-sm text-gray-500">These instructions will be applied to all document processing tasks</p>
                  </div>
                  
                  <div className="bg-black/30 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-[#B4916C] font-medium mb-3">Default Format Preferences</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Preferred Output Format</label>
                        <select className="w-full bg-black border border-gray-700 text-gray-300 rounded-md px-3 py-2">
                          <option value="same">Same as Input</option>
                          <option value="pdf">PDF</option>
                          <option value="docx">DOCX</option>
                          <option value="txt">Plain Text</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Font Preference</label>
                        <select className="w-full bg-black border border-gray-700 text-gray-300 rounded-md px-3 py-2">
                          <option value="default">Default</option>
                          <option value="arial">Arial</option>
                          <option value="times">Times New Roman</option>
                          <option value="calibri">Calibri</option>
                          <option value="georgia">Georgia</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white w-full">
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
} 