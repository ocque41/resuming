// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { ArticleTitle } from "@/components/ui/article";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
  const activityLogs = await getActivityLogs(); // Fetch activity logs for UserMenu
  // Dummy settings data; replace with real settings as needed.
  const generalSettings = {};
  const securitySettings = {};

  return (
    <>
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <ArticleTitle className="text-md lg:text-xl font-medium ml-4">
          Dashboard
        </ArticleTitle>
        <UserMenu 
          teamData={teamData}
          activityLogs={activityLogs}
          generalSettings={generalSettings}
          securitySettings={securitySettings}
        />
      </header>
      <CardTitle className="text-sm text-gray-500 text-center mt-2 mx-auto max-w-md lg:max-w-2xl">
        General Suite
      </CardTitle>
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
        <CardContent>
          <Table className="w-full">
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
                    <TableCell className="text-sm lg:text-base">
                      {cv.fileName}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base">
                      {metadata?.atsScore || "-"}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base">
                      {metadata?.optimized || "-"}
                    </TableCell>
                    <TableCell className="text-sm lg:text-base">
                      <DeleteCVButton cvId={cv.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DashboardClientWrapper cvs={cvs} />
    </>
  );
}
