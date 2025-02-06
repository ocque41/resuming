import { redirect } from 'next/navigation';
import { ArticleTitle } from '@/components/ui/article';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getTeamForUser, getUser } from '@/lib/db/queries';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const teamData = await getTeamForUser(user.id);

  if (!teamData) {
    throw new Error('Team not found');
  }


  return (
    <>
      <header className="flex flex-col items-center p-4 lg:p-8 space-y-4">
        <ArticleTitle className="text-lg lg:text-2xl font-medium">Dashboard</ArticleTitle>
        <CardTitle className="text-base lg:text-xl font-light">Your Uploaded CVs</CardTitle>
        <a href="/dashboard/settings" className="h-8 w-8 lg:h-10 lg:w-10">
          <Avatar className="cursor-pointer">
            <AvatarImage src="/path/to/avatar.jpg" alt="User Avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </a>
      </header>
      <Card className="mb-8 mx-auto max-w-md lg:max-w-2xl">
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
    </>
  );
}
