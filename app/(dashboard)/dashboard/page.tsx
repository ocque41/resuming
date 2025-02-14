// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getTeamForUser, getUser, getCVsForUser } from "@/lib/db/queries";
import { ArticleTitle } from "@/components/ui/article";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogBody } from "@/components/ui/dialog";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// Import the client wrapper and the new delete button component.
import DashboardClientWrapper from "@/components/dashboard-client-wrapper";
import DeleteCVButton from "@/components/delete-cv";

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
        <Dialog>
          <DialogTrigger asChild>
            <Avatar className="cursor-pointer h-8 w-8 lg:h-10 lg:w-10 ml-auto">
              <AvatarImage src="/path/to/avatar.jpg" alt="User Avatar" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogBody>
                <ul className="space-y-2">
                  <li>
                    <a href="/billing" className="block text-center">Billing</a>
                  </li>
                  <li>
                    <a href="/dashboard/settings" className="block text-center">Settings</a>
                  </li>
                  <li>
                    <button className="block w-full text-center">Log Out</button>
                  </li>
                </ul>
              </DialogBody>
            </DialogHeader>
          </DialogContent>
        </Dialog>
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
                    <TableCell>{cv.fileName}</TableCell>
                    <TableCell>{metadata?.atsScore || "-"}</TableCell>
                    <TableCell>{metadata?.optimized || "-"}</TableCell>
                    <TableCell>{metadata?.sent || "-"}</TableCell>
                    <TableCell>
                      <DeleteCVButton cvId={cv.id} />
                    </TableCell>
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
