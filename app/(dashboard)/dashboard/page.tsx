// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { ArticleTitle } from "@/components/ui/article";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import OptimizeCVCard from "@/components/OptimizeCVCard.client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DashboardClientWrapper from "@/components/dashboard-client-wrapper";
import DeleteCVButton from "@/components/delete-cv";
import UserMenu from "@/components/UserMenu";
import ActionsDropdown from "@/components/ActionsDropdown";
import Link from "next/link";
import { ArrowRight, Diamond } from "lucide-react";

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

  return (
    <>
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <ArticleTitle className="text-md lg:text-xl font-medium ml-4 text-[#B4916C]">
          Dashboard
        </ArticleTitle>
        <UserMenu teamData={teamData} activityLogs={activityLogs} />
      </header>
      
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg">
        <CardHeader className="bg-[#B4916C]/10 pb-4">
          <CardTitle className="text-xl font-bold text-[#B4916C]">Your CV Collection</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b border-[#B4916C]/20">
                <TableHead className="text-[#B4916C] font-semibold">Name</TableHead>
                <TableHead className="text-[#B4916C] font-semibold">ATS Score</TableHead>
                <TableHead className="text-[#B4916C] font-semibold">Optimized</TableHead>
                <TableHead className="text-[#B4916C] font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cvs.map((cv: any) => {
                let metadata = null;
                try {
                  metadata = cv.metadata ? JSON.parse(cv.metadata) : null;
                } catch (err) {
                  console.error("Error parsing metadata:", err);
                }
                return (
                  <TableRow key={cv.id} className="border-b border-gray-800 hover:bg-[#B4916C]/5">
                    <TableCell className="text-sm lg:text-base text-gray-300 font-medium">
                      {cv.fileName}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base">
                      {metadata?.atsScore ? (
                        <span className="px-2 py-1 bg-[#B4916C]/10 rounded-full text-[#B4916C] font-medium text-sm">
                          {metadata.atsScore}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base">
                      {metadata?.optimized ? (
                        <span className="px-2 py-1 bg-green-900/30 rounded-full text-green-400 font-medium text-sm">
                          Yes ({metadata.optimizedTimes || 1})
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-800 rounded-full text-gray-400 font-medium text-sm">
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base">
                      <ActionsDropdown cv={cv} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Premium Plan Upgrade Card */}
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C] bg-[#B4916C]/10 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-full bg-[#B4916C]/20 flex items-center justify-center">
              <Diamond className="h-5 w-5 text-[#B4916C]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#B4916C]">Upgrade to Premium</h3>
              <p className="text-gray-300">Get unlimited CV uploads and optimizations</p>
            </div>
          </div>
          <Link 
            href="/dashboard/pricing" 
            className="px-4 py-2 rounded-md bg-[#B4916C] hover:bg-[#B4916C]/90 text-white font-medium flex items-center space-x-1 transition-colors"
          >
            <span>Upgrade</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </CardContent>
      </Card>
      
      <DashboardClientWrapper cvs={cvs} />
      
      <AnalyzeCVCard cvs={cvs.map((cv) => cv.fileName)} />
      
      <OptimizeCVCard cvs={cvs.map((cv) => cv.fileName)} />
    </>
  );
}
