import { redirect } from 'next/navigation';
import { ArticleTitle } from '@/components/ui/article';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getTeamForUser, getUser } from '@/lib/db/queries';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

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
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <ArticleTitle className="text-lg lg:text-2xl font-medium mr-auto">Dashboard</ArticleTitle>
        <a href="/dashboard/settings" className="h-8 w-8 lg:h-10 lg:w-10 ml-auto">
          <Avatar className="cursor-pointer">
            <AvatarImage src="/path/to/avatar.jpg" alt="User Avatar" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </a>
      </header>
      <CardTitle className="text-base lg:text-xl font-light mt-6 mx-auto max-w-md lg:max-w-2xl text-right">My CVs</CardTitle>
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
              {/* Example row, replace with dynamic data */}
              <TableRow>
                <TableCell>John Doe CV</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm">Analyze</Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/cv-optimization">Optimize</a>
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/jobs">Jobs</a>
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
