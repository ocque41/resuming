import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Eye, File, FileText, Settings, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EnhancedCVPreview from "@/components/EnhancedCVPreview.client";

export default async function EnhancePage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  const cvs = await getCVsForUser(user.id);
  
  return (
    <>
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-6xl">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-8 w-8 rounded-md bg-[#121212] hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg lg:text-xl font-medium text-white">
            Advanced CV Enhancement
          </h1>
        </div>
      </header>
      
      <div className="mx-auto max-w-md lg:max-w-6xl px-4 lg:px-8 mb-16">
        <Card className="mt-4 mb-8 border border-[#B4916C]/20 bg-[#121212] shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#B4916C]">Enhance Your CV</CardTitle>
            <CardDescription className="text-gray-400">
              Take your CV to the next level with professional styling, formatting, and optimization
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <p className="mb-4 text-gray-300">
              Our CV enhancement features help you create a professionally styled CV that stands out to recruiters and ATS systems.
              Choose from various styling options, customize colors, and generate high-quality PDFs tailored to your industry.
            </p>
            
            <Tabs defaultValue="styling" className="w-full">
              <TabsList className="grid grid-cols-4 mb-6 bg-[#1a1a1a]">
                <TabsTrigger value="styling" className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white">
                  <Eye className="h-4 w-4 mr-2" />
                  Styling
                </TabsTrigger>
                <TabsTrigger value="content" className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="templates" className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white">
                  <File className="h-4 w-4 mr-2" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="styling">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <EnhancedCVPreview 
                    cvs={cvs.map((cv: any) => `${cv.fileName}|${cv.id}`)} 
                  />
                  
                  <Card className="border border-[#B4916C]/20 bg-[#121212]/50 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-[#B4916C] text-lg">Styling Guidelines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-gray-300">
                        <div>
                          <h3 className="text-white font-medium mb-1">Modern & Professional</h3>
                          <p className="text-sm">
                            Our enhanced styling uses modern typography, balanced spacing, and professional color schemes to make your CV visually appealing while maintaining professionalism.
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="text-white font-medium mb-1">ATS-Friendly Structure</h3>
                          <p className="text-sm">
                            The enhanced CV format is optimized for Applicant Tracking Systems while also appealing to human recruiters, improving your chances of getting through automated filters.
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="text-white font-medium mb-1">Consistent Formatting</h3>
                          <p className="text-sm">
                            We ensure consistent formatting across sections, proper bullet point alignment, and balanced content distribution for a polished look.
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="text-white font-medium mb-1">Visual Hierarchy</h3>
                          <p className="text-sm">
                            The enhanced layout establishes clear visual hierarchy, making it easy for recruiters to scan and locate important information quickly.
                          </p>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-800">
                          <h3 className="text-[#B4916C] font-medium mb-2">Pro Tips</h3>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Choose an accent color that matches your industry (blue for corporate, green for creative)</li>
                            <li>Ensure your contact information is clearly visible at the top</li>
                            <li>Keep your formatting consistent throughout all sections</li>
                            <li>Use high-quality paper if printing your enhanced CV</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="content">
                <div className="text-center py-10">
                  <Download className="h-12 w-12 mx-auto text-[#B4916C] mb-4" />
                  <h3 className="text-xl font-medium text-gray-200 mb-2">Coming Soon</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Advanced content enhancement features are under development. 
                    Check back soon for AI-powered content suggestions and industry-specific improvements.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="templates">
                <div className="text-center py-10">
                  <Download className="h-12 w-12 mx-auto text-[#B4916C] mb-4" />
                  <h3 className="text-xl font-medium text-gray-200 mb-2">Coming Soon</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Additional CV templates are being developed to give you more options.
                    Check back soon for industry-specific and role-based templates.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="settings">
                <div className="text-center py-10">
                  <Download className="h-12 w-12 mx-auto text-[#B4916C] mb-4" />
                  <h3 className="text-xl font-medium text-gray-200 mb-2">Coming Soon</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Advanced settings for CV enhancement are under development.
                    Check back soon for personalization options and export settings.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 