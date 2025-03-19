import { redirect } from "next/navigation";
import { getUser } from "@/lib/db/queries.server";
import JobMatchAnalysisVisualizer from "../../components/JobMatchAnalysisVisualizer.client";
import PageLayout from "@/components/PageLayout";

export default async function JobMatchPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  return (
    <PageLayout title="CV to Job Match Analysis">
      <JobMatchAnalysisVisualizer />
    </PageLayout>
  );
} 