// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getTeamForUser, getUser, getCVsForUser } from "@/lib/db/queries";
import { ArticleTitle } from "@/components/ui/article";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import BillingButton from './billing-button';
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
        <ArticleTitle className="text-md lg:text-xl font-medium ml-4">
          Dashboard
        </ArticleTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Avatar className={cn("cursor-pointer h-10 w-10 lg:h-12 lg:w-12 ml-auto", "bg-[#584235]")}>
              <AvatarImage src="/path/to/avatar.jpg" alt="User Avatar" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogBody>
                <ul className="space-y-2 flex flex-col items-center">
                  <li>
                    <BillingButton />
                  </li>
                  <li>
                    <a href="/dashboard/settings" className="block text-center bg-indigo-600 text-white py-2 px-4 rounded-md">Settings</a>
                  </li>
                  <li>
                    <button className="block w-full text-center bg-indigo-600 text-white py-2 px-4 rounded-md">Log Out</button>
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
