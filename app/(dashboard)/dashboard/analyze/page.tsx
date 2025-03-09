import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, FileText, BarChart2, PieChart, LineChart, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DocumentAnalysisPage() {
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
      <header className="flex items-center justify-between p-4 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-5xl">
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
      
      <div className="flex flex-col space-y-6 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-5xl px-2 sm:px-4 md:px-6 pb-12">
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
            
            {/* Document Selection */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select a Document to Analyze
              </label>
              <div className="flex gap-4">
                <select 
                  className="flex-1 bg-black border border-gray-700 rounded-md p-2.5 text-gray-300 focus:ring-[#B4916C] focus:border-[#B4916C]"
                >
                  <option value="">Select a document...</option>
                  {documents.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>{doc.fileName}</option>
                  ))}
                </select>
                <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                  Analyze
                </Button>
              </div>
            </div>
            
            {/* Coming Soon Message */}
            <div className="bg-black/30 rounded-lg p-8 text-center border border-[#B4916C]/20">
              <BarChart2 className="h-16 w-16 text-[#B4916C] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#B4916C] mb-2">Coming Soon</h3>
              <p className="text-gray-300 mb-4 max-w-md mx-auto">
                Our advanced document analytics feature is currently in development.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8 text-left">
                <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
                  <div className="flex items-center mb-3">
                    <PieChart className="h-5 w-5 text-[#B4916C] mr-2" />
                    <h4 className="text-white font-medium">Content Analysis</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Analyze content distribution, topics, and key themes in your documents
                  </p>
                </div>
                
                <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
                  <div className="flex items-center mb-3">
                    <LineChart className="h-5 w-5 text-[#B4916C] mr-2" />
                    <h4 className="text-white font-medium">Sentiment Analysis</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Understand emotional tone and sentiment throughout your documents
                  </p>
                </div>
                
                <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
                  <div className="flex items-center mb-3">
                    <List className="h-5 w-5 text-[#B4916C] mr-2" />
                    <h4 className="text-white font-medium">Key Information</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Automatically extract key entities, names, dates, and facts
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 