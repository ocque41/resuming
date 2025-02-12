// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getTeamForUser, getUser, getCVsForUser } from "@/lib/db/queries";
// Other server components can remain server components.
import { ArticleTitle } from "@/components/ui/article";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// Import the client wrapper (which is marked "use client")
import DashboardClientWrapper from "@/components/dashboard-client-wrapper";

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

  return (
    <>
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <ArticleTitle className="text-lg lg:text-2xl font-medium ml-4">
          Dashboard
        </ArticleTitle>
        <a href="/dashboard/settings" className="h-8 w-8 lg:h-10 lg:w-10 ml-auto">
          <Avatar className="cursor-pointer">
            <AvatarImage src="/path/to/avatar.jpg" alt="User Avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </a>
      </header>
      <CardTitle className="text-sm text-gray-500 text-center mt-2 mx-auto max-w-md lg:max-w-2xl">
        General Suite
      </CardTitle>
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl">
        <CardContent>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ATS Score</TableHead>
                <TableHead>Optimized</TableHead>
                <TableHead>Sent</TableHead>
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
                    <TableCell>{cv.fileName}</TableCell>
                    <TableCell>{metadata?.atsScore || "-"}</TableCell>
                    <TableCell>{metadata?.optimized || "-"}</TableCell>
                    <TableCell>{metadata?.sent || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Render client-only interactive components via the client wrapper */}
      <DashboardClientWrapper cvs={cvs} />
    </>
  );
}
