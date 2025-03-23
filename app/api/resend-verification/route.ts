import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { db } from "@/lib/db/drizzle";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createVerificationToken } from '@/lib/auth/verification';
import { sendVerificationEmail } from '@/lib/email/resend';
import { updateUserVerificationStatus } from '@/lib/notion/notion';
import { verificationEmailLimiter } from '@/lib/rate-limiting/upstash';

// Schema for request validation
const RequestSchema = z.object({
  email: z.string().email("Invalid email address")
});

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Validate the request body
    const validatedData = RequestSchema.safeParse(body);
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid request: " + validatedData.error.message },
        { status: 400 }
      );
    }
    
    const { email } = validatedData.data;
    
    // Apply rate limiting based on email
    const rateLimitResult = await verificationEmailLimiter(email);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many verification requests. Please try again later.',
          reset: rateLimitResult.reset.toISOString()
        },
        { status: 429 }
      );
    }
    
    // Find the user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    if (existingUser.length === 0) {
      return NextResponse.json(
        { error: "User not found. Please check your email address." },
        { status: 404 }
      );
    }
    
    const user = existingUser[0];
    
    // Check if the user is already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { message: "Email is already verified. You can sign in to your account." },
        { status: 200 }
      );
    }
    
    // Create a new verification token
    const token = await createVerificationToken(email);
    
    // Send the verification email
    try {
      const emailResult = await sendVerificationEmail(email, token);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        return NextResponse.json(
          { error: 'Failed to send verification email' },
          { status: 500 }
        );
      }
      
      // Update status in Notion if environment variable is set
      if (process.env.NOTION_SECRET && process.env.NOTION_DB) {
        try {
          await updateUserVerificationStatus(email, 'Pending');
        } catch (notionError) {
          console.error('Error updating Notion status:', notionError);
          // Continue even if Notion update fails
        }
      }
      
      return NextResponse.json(
        { 
          message: "Verification email sent successfully",
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset.toISOString()
        },
        { status: 200 }
      );
    } catch (emailError: any) {
      console.error("Error sending verification email:", emailError);
      
      return NextResponse.json(
        { 
          error: "Failed to send verification email. Please try again later.",
          details: emailError.message || "Unknown email sending error" 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in resend-verification API:", error);
    
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 