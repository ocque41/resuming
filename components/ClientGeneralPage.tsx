"use client";

import { startTransition } from 'react';
import { useActionState } from '@/lib/useActionState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/lib/auth';
import { updateAccount } from '@/app/(login)/actions';

type ActionState = {
  error?: string;
  success?: string;
};

export default function ClientGeneralPage() {
  const { user } = useUser();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    (data) => updateAccount({ error: '', success: '' }, data),
    { error: '', success: '' }
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      formAction(new FormData(event.currentTarget));
    });
  };

  return (
    <section className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
      <Card className="mt-4 mb-8 border border-[#B4916C]/20 bg-[#050505] shadow-lg">
        <CardHeader className="bg-[#B4916C]/10 pb-4">
          <CardTitle className="text-xl font-bold text-[#B4916C]">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="name" className="text-gray-300">Name</Label>
              <Input
                id="name"
                name="name"
                className="mt-1 bg-[#121212] border-gray-700 text-gray-200 focus:border-[#B4916C] focus:ring-[#B4916C]"
                placeholder="Enter your name"
                defaultValue={user?.name || ''}
                required
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                className="mt-1 bg-[#121212] border-gray-700 text-gray-200 focus:border-[#B4916C] focus:ring-[#B4916C]"
                placeholder="Enter your email"
                defaultValue={user?.email || ''}
                required
              />
            </div>
            {state.error && (
              <p className="text-red-400 text-sm">{state.error}</p>
            )}
            {state.success && (
              <p className="text-green-400 text-sm">{state.success}</p>
            )}
            <Button
              type="submit"
              className="bg-[#B4916C] hover:bg-[#B4916C]/90 text-white"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
} 