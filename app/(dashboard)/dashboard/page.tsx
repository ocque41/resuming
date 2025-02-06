import { redirect } from 'next/navigation';
import { ArticleTitle } from '@/components/ui/article';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getTeamForUser, getUser } from '@/lib/db/queries';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DashboardComboboxes } from '@/components/ui/dashboard-comboboxes';

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error('Team not found');
  }

  const cvs = (teamData as any).cvs || [];

  if (!teamData) {
    throw new Error('Team not found');
  }

  return (
    <>
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <ArticleTitle className="text-lg lg:text-2xl font-medium ml-2">Dashboard</ArticleTitle>
        <a href="/dashboard/settings" className="h-8 w-8 lg:h-10 lg:w-10 ml-auto">
          <Avatar className="cursor-pointer">
            <AvatarImage src="/path/to/avatar.jpg" alt="User Avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </a>
      </header>
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base lg:text-xl font-light">General Suite</CardTitle>
        </CardHeader>
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
              {/* Example row, replace with dynamic data */}
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
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base lg:text-xl font-light">Analyze CV</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start">
          {/* Placeholder for cool analysis animation */}
          <div className="w-full h-32 bg-gray-200 animate-pulse mb-4"></div>
          <div className="w-full">
            <DashboardComboboxes cvs={cvs} comboboxType="analyze" />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base lg:text-xl font-light">Optimize CV</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start">
          {/* Placeholder for cool optimization animation */}
          <div className="w-full h-32 bg-gray-200 animate-pulse mb-4"></div>
          <div className="w-full">
            <DashboardComboboxes cvs={cvs} comboboxType="other" />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base lg:text-xl font-light">Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable />
        </CardContent>
      </Card>
    </>
  );
}
