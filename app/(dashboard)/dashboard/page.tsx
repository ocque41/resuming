// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { ArticleTitle } from "@/components/ui/article";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
        <ArticleTitle className="text-md lg:text-xl font-medium ml-4 text-white">
          Dashboard
        </ArticleTitle>
        <UserMenu teamData={teamData} activityLogs={activityLogs} />
      </header>
      
      <CardTitle className="text-sm text-white text-center mt-2 mx-auto max-w-md lg:max-w-2xl">
        General Suite
      </CardTitle>
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl bg-[#050505] border border-[#E8DCC4]">
        <CardContent>
          <Table className="w-full text-white">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ATS Score</TableHead>
                <TableHead>Optimized</TableHead>
                <TableHead>Actions</TableHead>
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
                  <TableRow key={cv.id}>
                    <TableCell className="text-sm lg:text-base text-white">
                      {cv.fileName}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base text-white">
                      {metadata?.atsScore ? `${metadata.atsScore}%` : "-"}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base text-white">
                      {metadata?.optimized ? `Yes (${metadata.optimizedTimes || 1})` : "No"}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base text-white">
                      <ActionsDropdown cv={cv} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <DashboardClientWrapper cvs={cvs} />
      
      <CardTitle className="text-sm text-white text-center mt-2 mx-auto max-w-md lg:max-w-2xl">
        Analyze CV
      </CardTitle>
      <AnalyzeCVCard cvs={cvs.map((cv) => cv.fileName)} />
      
      <CardTitle className="text-sm text-white text-center mt-2 mx-auto max-w-md lg:max-w-2xl">
        Optimize CV
      </CardTitle>
      <OptimizeCVCard cvs={cvs.map((cv) => cv.fileName)} />
    </>
  );
}
