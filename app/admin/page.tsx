import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db/drizzle";
import { users, teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AdminStats } from "./stats";

export const metadata = {
  title: "Admin Dashboard | User Management",
  description: "Manage users and view system statistics",
};

async function UsersList() {
  // Fetch users with their teams
  const usersWithTeams = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      admin: users.admin,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      team: teams.name,
      planName: teams.planName,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .orderBy(users.createdAt);

  return (
    <div className="rounded-md border">
      <div className="py-4 px-6 bg-black/5 flex items-center justify-between">
        <h3 className="text-lg font-medium">Users</h3>
        <span className="text-sm text-muted-foreground">
          {usersWithTeams.length} total
        </span>
      </div>
      <div className="divide-y">
        {usersWithTeams.map((user) => (
          <div key={user.id} className="py-3 px-6 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="font-medium">{user.name || "No Name"}</div>
              {user.admin && (
                <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
                  Admin
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span>Team: {user.team || "No Team"}</span>
              <span>Plan: {user.planName || "No Plan"}</span>
              <span>
                Email Verification:{" "}
                {user.emailVerified ? "Verified" : "Not Verified"}
              </span>
              <span>
                Created:{" "}
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users and view system statistics
        </p>
      </div>

      <Suspense 
        fallback={
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">...</div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <AdminStats />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage all registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading users...</div>}>
            <UsersList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
} 