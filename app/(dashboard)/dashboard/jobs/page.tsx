import { redirect } from "next/navigation";

export default async function JobMatchingPage() {
  // This feature has been removed from the application
  // Redirect users to the dashboard
  redirect("/dashboard");
} 