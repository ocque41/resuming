import { redirect } from 'next/navigation';
import { ArticleTitle } from '@/components/ui/article';
import { getTeamForUser, getUser } from '@/lib/db/queries';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Table from '@/components/ui/table';

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
      <header className="flex justify-between items-center p-4 lg:p-8">
        <ArticleTitle className="text-lg lg:text-2xl font-medium">Dashboard</ArticleTitle>
        <a href="/dashboard/settings">
          <img src="/icons/detectiv.svg" alt="Detectiv Icon" className="h-8 w-8 lg:h-12 lg:w-12 filter invert" />
        </a>
      </header>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Uploaded CVs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>ATS Score</th>
                <th>Optimized</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {/* Example row, replace with dynamic data */}
              <tr>
                <td>John Doe CV</td>
                <td>85%</td>
                <td>Yes</td>
                <td>No</td>
              </tr>
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
