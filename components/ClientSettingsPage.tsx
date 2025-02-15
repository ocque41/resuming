"use client";

import { useState } from "react";
import { TeamDataWithMembers, User } from "@/lib/db/schema";
import { removeTeamMember } from "@/app/(login)/actions";

type ActionState = {
  error?: string;
  success?: string;
};

export default function ClientSettingsPage({ teamData }: { teamData: TeamDataWithMembers }) {
  const [removeState, setRemoveState] = useState<ActionState>({ error: "", success: "" });
  const [isRemovePending, setIsRemovePending] = useState(false);

  const handleRemoveAction = async (memberId: string) => {
    setIsRemovePending(true);
    try {
      const formData = new FormData();
      formData.append("memberId", memberId);
      await removeTeamMember({ error: "", success: "" }, formData);
      setRemoveState({ success: "Member removed successfully", error: "" });
    } catch (error) {
      setRemoveState({ error: "Failed to remove member", success: "" });
    } finally {
      setIsRemovePending(false);
    }
  };

  const getUserDisplayName = (user: Pick<User, "id" | "name" | "email">) => {
    return user.name || user.email || "Unknown User";
  };

  return (
    <section>
      {/* Your interactive settings content goes here */}
      <p>Settings content goes here.</p>
    </section>
  );
}
