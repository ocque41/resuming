import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Briefcase, Search, MapPin, Filter, BarChart2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function JobMatchingPage() {
  // Redirect to dashboard as this feature is no longer available
  redirect("/dashboard");
  
  // The code below will not execute due to the redirect
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
      <header className="flex items-center justify-between p-4 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-5xl">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg lg:text-xl font-medium text-white">
            Find Matching Jobs
          </h1>
        </div>
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-5xl px-2 sm:px-4 md:px-6 pb-12">
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#B4916C]">Job Matching Engine</CardTitle>
            <CardDescription className="text-gray-400">
              Find jobs that perfectly match your CV and skills
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-4 md:p-6">
            <p className="mb-6 text-gray-300">
              Our AI-powered job matching system analyzes your CV to find the most relevant job opportunities.
              Select a CV to analyze and customize your search criteria for best results.
            </p>
            
            {/* CV Selection and Search Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select a CV for Job Matching
                </label>
                <select 
                  className="w-full bg-black border border-gray-700 rounded-md p-2.5 text-gray-300 focus:ring-[#B4916C] focus:border-[#B4916C]"
                >
                  <option value="">Select a CV...</option>
                  {cvs.map((cv: any) => (
                    <option key={cv.id} value={cv.id}>{cv.fileName}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Job Title/Keywords
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    placeholder="Search job titles, keywords..."
                    className="pl-10 bg-black border-gray-700 text-gray-300"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                    placeholder="City, state, or remote"
                    className="pl-10 bg-black border-gray-700 text-gray-300"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white w-full">
                  Find Matching Jobs
                </Button>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">Job Matches</h2>
                <Button variant="outline" className="text-gray-300 border-gray-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>
              
              <Tabs defaultValue="list" className="w-full">
                <TabsList className="grid grid-cols-2 mb-4 bg-black border border-gray-800">
                  <TabsTrigger value="list" className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white">
                    List View
                  </TabsTrigger>
                  <TabsTrigger value="map" className="data-[state=active]:bg-[#B4916C] data-[state=active]:text-white">
                    Map View
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="list" className="space-y-4">
                  <div className="relative bg-black/30 rounded-lg p-6 border border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium text-white">Senior Frontend Developer</h3>
                      <div className="px-2 py-1 bg-[#B4916C]/10 rounded-md">
                        <div className="flex items-center">
                          <BarChart2 className="h-4 w-4 text-[#B4916C] mr-1" />
                          <span className="text-[#B4916C] font-medium">95% Match</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-400 mb-3">
                      <Briefcase className="h-4 w-4 mr-1" />
                      <span className="mr-3">TechCorp Inc.</span>
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>San Francisco, CA</span>
                      <Badge className="ml-2 bg-gray-800 text-gray-300">Remote</Badge>
                    </div>
                    <p className="text-gray-300 mb-4">
                      Join our dynamic team creating innovative web applications using React, TypeScript, and modern frontend tools. Looking for a candidate with 5+ years of experience who can lead development efforts.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge className="bg-[#B4916C]/10 text-[#B4916C] border-[#B4916C]/20">React</Badge>
                      <Badge className="bg-[#B4916C]/10 text-[#B4916C] border-[#B4916C]/20">TypeScript</Badge>
                      <Badge className="bg-[#B4916C]/10 text-[#B4916C] border-[#B4916C]/20">NextJS</Badge>
                      <Badge className="bg-[#B4916C]/10 text-[#B4916C] border-[#B4916C]/20">UI/UX</Badge>
                    </div>
                    <div className="flex justify-end">
                      <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                        View Job
                      </Button>
                    </div>
                    
                    {/* Coming Soon Overlay */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <div className="text-center p-6">
                        <Briefcase className="h-12 w-12 text-[#B4916C] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#B4916C] mb-2">Coming Soon</h3>
                        <p className="text-gray-300 mb-4">Our job matching feature is currently in development.</p>
                        <p className="text-gray-400 text-sm">We're working hard to help you find your perfect job match!</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="map">
                  <div className="relative h-[400px] bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-center">
                    <p className="text-gray-400">Map view will display job locations</p>
                    
                    {/* Coming Soon Overlay */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <div className="text-center p-6">
                        <Briefcase className="h-12 w-12 text-[#B4916C] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#B4916C] mb-2">Coming Soon</h3>
                        <p className="text-gray-300 mb-4">Our job mapping feature is currently in development.</p>
                        <p className="text-gray-400 text-sm">Soon you'll be able to view job opportunities geographically!</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="bg-black/30 p-6 rounded-lg border border-gray-800">
              <h3 className="text-[#B4916C] font-medium mb-4 flex items-center">
                <BarChart2 className="h-5 w-5 mr-2" />
                Job Match Insights
              </h3>
              <p className="text-gray-300 mb-4">
                Based on your CV analysis, here are the key insights to improve your job matches:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Top Skills in Demand</h4>
                  <p className="text-sm text-gray-400 mb-2">Skills that employers are looking for in your field:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-[#B4916C]/10 text-[#B4916C]">React</Badge>
                    <Badge className="bg-[#B4916C]/10 text-[#B4916C]">TypeScript</Badge>
                    <Badge className="bg-[#B4916C]/10 text-[#B4916C]">AWS</Badge>
                    <Badge className="bg-[#B4916C]/10 text-[#B4916C]">Node.js</Badge>
                  </div>
                </div>
                
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Skill Gap Analysis</h4>
                  <p className="text-sm text-gray-400 mb-2">Skills to develop to improve your match rate:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-gray-800 text-gray-300">GraphQL</Badge>
                    <Badge className="bg-gray-800 text-gray-300">Docker</Badge>
                    <Badge className="bg-gray-800 text-gray-300">CI/CD</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 