// app/(dashboard)/dashboard/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { ArticleTitle } from "@/components/ui/article";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTeamForUser, getUser } from "@/lib/db/queries";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DashboardComboboxes from "@/components/dashboard-comboboxes.client";
import DragAndDropUpload from '@/components/ui/drag&drop';

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }

  const cvs = (teamData as any).cvs || [];

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
      <CardTitle className="text-base lg:text-xl font-light mt-2 mx-auto max-w-md lg:max-w-2xl">
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
              {/* Example row; replace with dynamic data */}
              <TableRow>
                <TableCell>John Doe CV</TableCell>
                <TableCell>85%</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>No</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="bg-black text-white p-6 rounded-lg mt-8 mx-auto max-w-md lg:max-w-2xl h-192 flex items-center justify-center">
        <DragAndDropUpload />
      </div>
      {/* Pass only serializable data (cvs) to the client component */}
      <DashboardComboboxes cvs={cvs} />
    </>
  );
}
