'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Mail } from 'lucide-react';

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/white.png" alt="Resuming Logo" width={150} height={150} />
        </div>
        
        <Card className="bg-[#111111] border border-[#222222] shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-center text-[#F9F6EE] font-safiro">
              Account Created Successfully!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center text-center p-6">
            <div className="flex flex-col items-center space-y-6">
              <div className="bg-[#0D1F15] p-4 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              
              <div className="space-y-4">
                <p className="text-[#F9F6EE] font-borna text-lg">
                  Your account has been created successfully!
                </p>
                
                <div className="bg-[#161616] p-4 rounded-lg border border-[#222222]">
                  <div className="flex items-center mb-2">
                    <Mail className="text-[#B4916C] h-5 w-5 mr-2" />
                    <p className="text-[#F9F6EE] font-medium">Check Your Email</p>
                  </div>
                  <p className="text-[#C5C2BA] text-sm">
                    We've sent you two important emails:
                  </p>
                  <ul className="text-[#C5C2BA] text-sm mt-2 space-y-2 text-left">
                    <li className="flex items-start">
                      <span className="text-[#B4916C] mr-2">1.</span>
                      <span>A <strong>verification email</strong> with a link to verify your email address.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#B4916C] mr-2">2.</span>
                      <span>A <strong>welcome email</strong> with important information about your account.</span>
                    </li>
                  </ul>
                </div>
                
                <p className="text-[#8A8782] font-borna">
                  Please verify your email to unlock all features of your account.
                </p>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-center p-6 pt-0">
            <Link href="/dashboard/pricing" className="w-full">
              <Button
                className="w-full bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro"
              >
                Continue to Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 