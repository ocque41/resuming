// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DeleteCVButton from "@/components/delete-cv";
import UserMenu from "@/components/UserMenu";
import ActionsDropdown from "@/components/ActionsDropdown";
import Link from "next/link";
import { 
  BarChart2, FileText, Briefcase, Upload, PieChart, TrendingUp, 
  Search
} from "lucide-react";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";
import CVUploader from "@/components/CVUploader.client";
import PremiumFeatureCard from "@/components/PremiumFeatureCard";
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from "@/components/ui/premium-card";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import { motion } from "framer-motion";
import { colors } from "@/lib/design-tokens";

// Add a CV type definition
interface CV {
  id: string;
  userId: string;
  fileName: string;
  filePath?: string;
  filepath?: string;
  createdAt: Date;
  rawText?: string | null;
  metadata?: any;
  [key: string]: any;
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  const cvs = await getCVsForUser(user.id);
  const activityLogs = await getActivityLogs(); // For UserMenu

  // Animation settings for staggered children
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  // Get user display name
  const userName = user.name || 'User';

  return (
    <PremiumPageLayout 
      title="Welcome back"
      subtitle={userName}
      withGradientBackground
      withScrollIndicator
      animation="fade"
      teamData={teamData}
      activityLogs={activityLogs}
      maxWidth="2xl"
    >
      {/* CV Collection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <PremiumCard 
          variant="default" 
          shadowSize="lg"
          className="overflow-hidden"
        >
          <PremiumCardHeader>
            <PremiumCardTitle>Your CV Collection</PremiumCardTitle>
          </PremiumCardHeader>
          <PremiumCardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-b border-[#1A1A1A]">
                    <TableHead className="text-[#E2DFD7] font-safiro font-medium">Name</TableHead>
                    <TableHead className="text-[#E2DFD7] font-safiro font-medium">ATS Score</TableHead>
                    <TableHead className="text-[#E2DFD7] font-safiro font-medium">Optimized</TableHead>
                    <TableHead className="text-[#E2DFD7] font-safiro font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cvs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-[#8A8782] italic font-borna">
                        Upload your first CV to get started
                      </TableCell>
                    </TableRow>
                  ) : (
                    cvs.map((cv: any) => {
                      let metadata = null;
                      try {
                        metadata = cv.metadata ? JSON.parse(cv.metadata) : null;
                      } catch (err) {
                        console.error("Error parsing metadata:", err);
                      }
                      return (
                        <TableRow key={cv.id} className="border-b border-[#1A1A1A] hover:bg-[#0A0A0A]">
                          <TableCell className="text-sm text-[#F9F6EE] font-borna font-medium">
                            {cv.fileName}
                          </TableCell>
                          <TableCell className="text-sm">
                            {metadata?.atsScore ? (
                              <span 
                                className={`px-2.5 py-1 rounded-md text-sm font-borna ${
                                  parseInt(metadata.atsScore) >= 80 
                                    ? "bg-[#0D1F15] text-[#4ADE80]" 
                                    : parseInt(metadata.atsScore) >= 60 
                                    ? "bg-[#1A140A] text-[#FCD34D]" 
                                    : "bg-[#1A0505] text-[#F5C2C2]"
                                }`}
                              >
                                {metadata.atsScore}
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {metadata?.optimized ? (
                              <span className="px-2.5 py-1 bg-[#0D1F15] rounded-md text-[#4ADE80] font-borna text-sm">
                                Yes
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-[#161616] rounded-md text-[#8A8782] font-borna text-sm">
                                No
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ActionsDropdown cv={cv} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </PremiumCardContent>
        </PremiumCard>
      </motion.div>
      
      {/* CV Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center mb-2">
          <Upload className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-safiro font-semibold text-[#F9F6EE]">Upload New CV</h2>
        </div>
        <ErrorBoundaryWrapper>
          <CVUploader />
        </ErrorBoundaryWrapper>
      </motion.div>
      
      {/* Feature Links */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center mb-4">
          <Search className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-safiro font-semibold text-[#F9F6EE]">Tools & Features</h2>
        </div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <PremiumFeatureCard 
            href="/dashboard/optimize"
            icon={TrendingUp}
            title="Optimize CV"
            description="Analyze & optimize for ATS"
            iconBgColor="bg-[#050505]"
            bgGradient
            animationDelay={0.1}
            withElevation
          />
          
          <PremiumFeatureCard 
            href="/dashboard/enhance"
            icon={FileText}
            title="Document Editor"
            description="Edit with AI assistance"
            iconBgColor="bg-[#050505]"
            bgGradient
            animationDelay={0.15}
            withElevation
          />
          
          <PremiumFeatureCard 
            href="/dashboard/analyze"
            icon={PieChart}
            title="Document Analysis"
            description="Extract insights & visualize data"
            iconBgColor="bg-[#050505]"
            bgGradient
            animationDelay={0.2}
            withElevation
          />
          
          <PremiumFeatureCard 
            href="/job-description"
            icon={FileText}
            title="Job Description Generator"
            description="Create detailed job descriptions"
            iconBgColor="bg-[#050505]"
            bgGradient
            animationDelay={0.25}
            withElevation
          />
          
          <PremiumFeatureCard 
            href="/job-match"
            icon={BarChart2}
            title="CV to Job Match"
            description="Analyze CV against job descriptions"
            iconBgColor="bg-[#050505]"
            bgGradient
            animationDelay={0.3}
            withElevation
          />
          
          <PremiumFeatureCard 
            href="/dashboard/jobs"
            icon={Briefcase}
            title="Find Matching Jobs"
            description="Discover jobs that match your CV"
            fullWidth
            accentBorder
            animationDelay={0.35}
            withElevation
          />
        </motion.div>
      </motion.div>
    </PremiumPageLayout>
  );
}
