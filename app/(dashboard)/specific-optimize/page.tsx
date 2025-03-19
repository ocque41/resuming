import { redirect } from "next/navigation";
import { getUser, getCVsForUser } from "@/lib/db/queries.server";
import EnhancedSpecificOptimizationWorkflow from "../../components/EnhancedSpecificOptimizationWorkflow.client";
import PageLayout from "@/components/PageLayout";

export default async function SpecificOptimizePage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Fetch CVs for the user
  const cvs = await getCVsForUser(user.id);
  const formattedCvs = cvs.map((cv: any) => ({
    id: cv.id,
    name: cv.fileName
  }));
  
  return (
    <PageLayout title="Specific CV Optimization">
      <EnhancedSpecificOptimizationWorkflow cvs={formattedCvs} />
    </PageLayout>
  );
} 