'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { useState } from 'react';
import { TeamDataWithMembers, User } from '@/lib/db/schema';
import { removeTeamMember } from '@/app/(login)/actions';
import { InviteTeamMember } from './invite-team';
import Settings from './settings/page';

type ActionState = {
  error?: string;
  success?: string;
};

export default function SettingsPage({ teamData }: { teamData: TeamDataWithMembers }) {
  const [removeState, setRemoveState] = useState<ActionState>({ error: '', success: '' });
  const [isRemovePending, setIsRemovePending] = useState(false);

  const handleRemoveAction = async (memberId: string) => {
    setIsRemovePending(true);
    try {
      const formData = new FormData();
      formData.append('memberId', memberId);
      await removeTeamMember(formData);
      setRemoveState({ success: 'Member removed successfully', error: '' });
    } catch (error) {
      setRemoveState({ error: 'Failed to remove member', success: '' });
    } finally {
      setIsRemovePending(false);
    }
  };

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  return (
    <section>
      {/* Add your JSX content here */}
    </section>
  );
}
