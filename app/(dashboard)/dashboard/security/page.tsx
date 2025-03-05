'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Trash2, Loader2 } from 'lucide-react';
import { startTransition } from 'react';
import { useActionState } from '@/lib/useActionState';
import { updatePassword, deleteAccount } from '@/app/(login)/actions';

type ActionState = {
  error?: string;
  success?: string;
};

export default function SecurityPage() {
  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    ActionState,
    FormData
  >(
    (data) => updatePassword({ error: '', success: '' }, data),
    { error: '', success: '' }
  );

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    ActionState,
    FormData
  >(
    (data) => deleteAccount({ error: '', success: '' }, data),
    { error: '', success: '' }
  );

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    // If you call the Server Action directly, it will automatically
    // reset the form. We don't want that here, because we want to keep the
    // client-side values in the inputs. So instead, we use an event handler
    // which calls the action. You must wrap direct calls with startTransition.
    // When you use the `action` prop it automatically handles that for you.
    // Another option here is to persist the values to local storage. I might
    // explore alternative options.
    startTransition(() => {
      passwordAction(new FormData(event.currentTarget));
    });
  };

  const handleDeleteSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    startTransition(() => {
      deleteAction(new FormData(event.currentTarget));
    });
  };

  return (
    <section className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
      <Card className="mt-4 mb-8 border border-[#B4916C]/20 bg-[#050505] shadow-lg">
        <CardHeader className="bg-[#B4916C]/10 pb-4">
          <CardTitle className="text-xl font-bold text-[#B4916C]">Password Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <div>
              <Label htmlFor="current-password" className="text-gray-300">Current Password</Label>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                className="mt-1 bg-[#121212] border-gray-700 text-gray-200 focus:border-[#B4916C] focus:ring-[#B4916C]"
                autoComplete="current-password"
                required
                minLength={8}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="text-gray-300">New Password</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                className="mt-1 bg-[#121212] border-gray-700 text-gray-200 focus:border-[#B4916C] focus:ring-[#B4916C]"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-gray-300">Confirm New Password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                className="mt-1 bg-[#121212] border-gray-700 text-gray-200 focus:border-[#B4916C] focus:ring-[#B4916C]"
                required
                minLength={8}
                maxLength={100}
              />
            </div>
            {passwordState.error && (
              <p className="text-red-400 text-sm">{passwordState.error}</p>
            )}
            {passwordState.success && (
              <p className="text-green-400 text-sm">{passwordState.success}</p>
            )}
            <Button
              type="submit"
              className="bg-[#B4916C] hover:bg-[#B4916C]/90 text-white"
              disabled={isPasswordPending}
            >
              {isPasswordPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4 mb-8 border border-[#B4916C]/20 bg-[#050505] shadow-lg">
        <CardHeader className="bg-[#B4916C]/10 pb-4">
          <CardTitle className="text-xl font-bold text-[#B4916C]">Delete Account</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-gray-300 mb-4">
            Account deletion is non-reversable. Please proceed with caution.
          </p>
          <form onSubmit={handleDeleteSubmit} className="space-y-4">
            <div>
              <Label htmlFor="delete-password" className="text-gray-300">Confirm Password</Label>
              <Input
                id="delete-password"
                name="password"
                type="password"
                className="mt-1 bg-[#121212] border-gray-700 text-gray-200 focus:border-[#B4916C] focus:ring-[#B4916C]"
                required
                minLength={8}
                maxLength={100}
              />
            </div>
            {deleteState.error && (
              <p className="text-red-400 text-sm">{deleteState.error}</p>
            )}
            <Button
              type="submit"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletePending}
            >
              {isDeletePending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
