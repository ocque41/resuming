// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getTeamForUser, getUser, getCVsForUser } from "@/lib/db/queries";
import { ArticleTitle } from "@/components/ui/article";
import { MicroCard } from "@/components/ui/micro-card";
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
            <MicroCard className={cn("cursor-pointer ml-auto", "bg-[#584235]")}>
              <span className="flex items-center justify-center h-full w-full rounded-full text-white text-lg">U</span>
            </MicroCard>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogBody>
                <div className="flex flex-col items-center space-y-2">
                  <a href="/dashboard/settings" className="text-white hover:underline">Settings</a>
                  <span className="text-gray-400">|</span>
                  <a href="#" className="text-white hover:underline">Log Out</a>
                  <span className="text-gray-400">|</span>
                  <a href="/manage-subscription" className="text-white hover:underline">Manage Subscription</a>
                </div>
              </DialogBody>
            </DialogHeader>
          </DialogContent>
        </Dialog>
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
                    <TableCell className="text-sm lg:text-base">{cv.fileName}</TableCell>
                    <TableCell className="text-sm lg:text-base">{metadata?.atsScore || "-"}</TableCell>
                    <TableCell className="text-sm lg:text-base">{metadata?.optimized || "-"}</TableCell>
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
      {/* Render client-only interactive components via the client wrapper */}
      <DashboardClientWrapper cvs={cvs} />
    </>
  );
}
