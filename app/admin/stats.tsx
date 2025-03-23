import { db } from "@/lib/db/drizzle";
import { users, teams } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function AdminStats() {
  // Get total users count
  const totalUsersResult = await db
    .select({ count: sql`count(*)` })
    .from(users);
  
  // Get verified users count
  const verifiedUsersResult = await db
    .select({ count: sql`count(*)` })
    .from(users)
    .where(sql`email_verified is not null`);
  
  // Get admin users count
  const adminUsersResult = await db
    .select({ count: sql`count(*)` })
    .from(users)
    .where(sql`admin = true`);
  
  // Get total teams count
  const totalTeamsResult = await db
    .select({ count: sql`count(*)` })
    .from(teams);
  
  const totalUsers = totalUsersResult[0]?.count || 0;
  const verifiedUsers = verifiedUsersResult[0]?.count || 0;
  const adminUsers = adminUsersResult[0]?.count || 0;
  const totalTeams = totalTeamsResult[0]?.count || 0;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUsers}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {verifiedUsers} verified ({Math.round((verifiedUsers / totalUsers) * 100) || 0}%)
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{verifiedUsers}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalUsers - verifiedUsers} unverified
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{adminUsers}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalUsers > 0 ? Math.round((adminUsers / totalUsers) * 100) : 0}% of total users
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTeams}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Avg. {totalUsers > 0 && totalTeams > 0 ? (totalUsers / totalTeams).toFixed(1) : 0} users per team
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 