'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Trash2, Loader2, Key, Shield, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { startTransition, useState } from 'react';
import { useActionState } from '@/lib/useActionState';
import { updatePassword, deleteAccount } from '@/app/(login)/actions';
import { motion, AnimatePresence } from 'framer-motion';

type ActionState = {
  error?: string;
  success?: string;
};

export default function SecurityPage() {
  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  
  // Form states
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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  return (
    <motion.section 
      className="space-y-8 mx-auto max-w-md lg:max-w-2xl"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants}>
        <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
          <CardHeader className="bg-[#0D0D0D] pb-4 border-b border-[#222222]">
            <CardTitle className="text-xl font-bold text-[#F9F6EE] font-safiro flex items-center">
              <Shield className="w-5 h-5 mr-2 text-[#B4916C]" />
              Password Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-6" onSubmit={handlePasswordSubmit}>
              <motion.div className="space-y-1" variants={itemVariants}>
                <Label htmlFor="current-password" className="text-[#C5C2BA] font-borna flex items-center">
                  <Key className="w-4 h-4 mr-2 text-[#B4916C]" />
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    className="mt-1 bg-[#0A0A0A] border-[#333333] text-[#F9F6EE] focus:border-[#B4916C] focus:ring-[#B4916C] rounded-lg pl-10 pr-10 font-borna h-12"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-[#B4916C] transition-colors"
                  >
                    {showCurrentPassword ? 
                      <EyeOff className="w-5 h-5" /> : 
                      <Eye className="w-5 h-5" />
                    }
                  </button>
                </div>
              </motion.div>
              
              <motion.div className="space-y-1" variants={itemVariants}>
                <Label htmlFor="new-password" className="text-[#C5C2BA] font-borna flex items-center">
                  <Key className="w-4 h-4 mr-2 text-[#B4916C]" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    className="mt-1 bg-[#0A0A0A] border-[#333333] text-[#F9F6EE] focus:border-[#B4916C] focus:ring-[#B4916C] rounded-lg pl-10 pr-10 font-borna h-12"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-[#B4916C] transition-colors"
                  >
                    {showNewPassword ? 
                      <EyeOff className="w-5 h-5" /> : 
                      <Eye className="w-5 h-5" />
                    }
                  </button>
                </div>
              </motion.div>
              
              <motion.div className="space-y-1" variants={itemVariants}>
                <Label htmlFor="confirm-password" className="text-[#C5C2BA] font-borna flex items-center">
                  <Key className="w-4 h-4 mr-2 text-[#B4916C]" />
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className="mt-1 bg-[#0A0A0A] border-[#333333] text-[#F9F6EE] focus:border-[#B4916C] focus:ring-[#B4916C] rounded-lg pl-10 pr-10 font-borna h-12"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-[#B4916C] transition-colors"
                  >
                    {showConfirmPassword ? 
                      <EyeOff className="w-5 h-5" /> : 
                      <Eye className="w-5 h-5" />
                    }
                  </button>
                </div>
              </motion.div>
              
              {/* Success and error messages */}
              <AnimatePresence>
                {passwordState.error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-red-400 text-sm p-2 bg-red-400/10 rounded-lg font-borna flex items-center"
                  >
                    <AlertCircle className="mr-2 h-4 w-4 text-red-400" />
                    {passwordState.error}
                  </motion.p>
                )}
                {passwordState.success && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-green-400 text-sm p-2 bg-green-400/10 rounded-lg font-borna flex items-center"
                  >
                    <Check className="mr-2 h-4 w-4 text-green-400" />
                    {passwordState.success}
                  </motion.p>
                )}
              </AnimatePresence>
              
              <motion.div variants={itemVariants}>
                <div className="relative">
                  <Button
                    type="submit"
                    className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-medium font-safiro h-12 rounded-lg transition-all duration-300"
                    disabled={isPasswordPending}
                  >
                    {isPasswordPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
          <CardHeader className="bg-[#0D0D0D] pb-4 border-b border-[#222222]">
            <CardTitle className="text-xl font-bold text-[#F9F6EE] font-safiro flex items-center">
              <Trash2 className="w-5 h-5 mr-2 text-red-500" />
              Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <motion.p 
              className="text-sm text-[#C5C2BA] mb-6 font-borna bg-[#1A0A0A] p-3 rounded-lg border border-red-900/30"
              variants={itemVariants}
            >
              <AlertCircle className="inline-block mr-2 h-4 w-4 text-red-400" />
              Warning: Account deletion is permanent and cannot be undone. All your data will be permanently removed.
            </motion.p>
            
            <form onSubmit={handleDeleteSubmit} className="space-y-6">
              <motion.div className="space-y-1" variants={itemVariants}>
                <Label htmlFor="delete-password" className="text-[#C5C2BA] font-borna flex items-center">
                  <Key className="w-4 h-4 mr-2 text-red-400" />
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="delete-password"
                    name="password"
                    type={showDeletePassword ? "text" : "password"}
                    className="mt-1 bg-[#0A0A0A] border-[#333333] text-[#F9F6EE] focus:border-red-500 focus:ring-red-500 rounded-lg pl-10 pr-10 font-borna h-12"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                  <button 
                    type="button" 
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-red-500 transition-colors"
                  >
                    {showDeletePassword ? 
                      <EyeOff className="w-5 h-5" /> : 
                      <Eye className="w-5 h-5" />
                    }
                  </button>
                </div>
              </motion.div>
              
              {/* Error message */}
              <AnimatePresence>
                {deleteState.error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="text-red-400 text-sm p-2 bg-red-400/10 rounded-lg font-borna flex items-center"
                  >
                    <AlertCircle className="mr-2 h-4 w-4 text-red-400" />
                    {deleteState.error}
                  </motion.p>
                )}
              </AnimatePresence>
              
              <motion.div variants={itemVariants}>
                <div className="relative">
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium font-safiro h-12 rounded-lg transition-all duration-300"
                    disabled={isDeletePending}
                  >
                    {isDeletePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting Account...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </>
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
