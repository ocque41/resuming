'use client';

import { startTransition } from 'react';
import { useActionState } from '@/lib/useActionState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, User, Mail, Check } from 'lucide-react';
import { useUser } from '@/lib/auth';
import { updateAccount } from '@/app/(login)/actions';
import { motion } from 'framer-motion';

type ActionState = {
  error?: string;
  success?: string;
};

export default function GeneralPage() {
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

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <motion.section 
      className="space-y-8 mx-auto max-w-md lg:max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { 
          opacity: 1, 
          transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
      }}
    >
      <motion.div variants={itemVariants}>
        <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
          <CardHeader className="bg-[#0D0D0D] pb-4 border-b border-[#222222]">
            <CardTitle className="text-xl font-bold text-[#F9F6EE] font-safiro">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <motion.div 
                className="space-y-1"
                variants={itemVariants}
              >
                <Label htmlFor="name" className="text-[#C5C2BA] font-borna flex items-center">
                  <User className="w-4 h-4 mr-2 text-[#B4916C]" />
                  Name
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    name="name"
                    className="mt-1 bg-[#0A0A0A] border-[#333333] text-[#F9F6EE] focus:border-[#B4916C] focus:ring-[#B4916C] rounded-lg pl-10 font-borna h-12"
                    placeholder="Enter your name"
                    defaultValue={user?.name || ''}
                    required
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                </div>
              </motion.div>
              
              <motion.div 
                className="space-y-1"
                variants={itemVariants}
              >
                <Label htmlFor="email" className="text-[#C5C2BA] font-borna flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-[#B4916C]" />
                  Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    className="mt-1 bg-[#0A0A0A] border-[#333333] text-[#F9F6EE] focus:border-[#B4916C] focus:ring-[#B4916C] rounded-lg pl-10 font-borna h-12"
                    placeholder="Enter your email"
                    defaultValue={user?.email || ''}
                    required
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                </div>
              </motion.div>
              
              {/* Success and error messages with animations */}
              <motion.div
                className="min-h-[24px]"
                initial={false}
                animate={{ 
                  height: state.error || state.success ? 'auto' : '24px',
                  opacity: state.error || state.success ? 1 : 0
                }}
                transition={{ duration: 0.3 }}
              >
                {state.error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-red-400 text-sm p-2 bg-red-400/10 rounded-lg font-borna flex items-center"
                  >
                    <span className="mr-2">⚠️</span>
                    {state.error}
                  </motion.p>
                )}
                {state.success && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-green-400 text-sm p-2 bg-green-400/10 rounded-lg font-borna flex items-center"
                  >
                    <Check className="mr-2 h-4 w-4 text-green-400" />
                    {state.success}
                  </motion.p>
                )}
              </motion.div>
              
              <motion.div variants={itemVariants}>
                <div className="relative">
                  <Button
                    type="submit"
                    className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-medium font-safiro h-12 rounded-lg transition-all duration-300"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}
