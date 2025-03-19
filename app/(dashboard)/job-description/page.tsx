import { redirect } from "next/navigation";
import { getUser } from "@/lib/db/queries.server";
import JobDescriptionGenerator from "../../components/JobDescriptionGenerator.client";
import PageLayout from "@/components/PageLayout";

export default async function JobDescriptionPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  return (
    <PageLayout title="Job Description Generator">
      <JobDescriptionGenerator />
    </PageLayout>
  );
} 