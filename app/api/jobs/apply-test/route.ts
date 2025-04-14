import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Helper function to execute command as promise
const execPromise = (command: string): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

// Helper function to write CV content to a temporary file
const writeTempFile = async (content: string, prefix: string): Promise<string> => {
  const tempFilePath = path.join(os.tmpdir(), `${prefix}_${crypto.randomUUID()}.txt`);
  await fs.writeFile(tempFilePath, content);
  return tempFilePath;
};

// This route is for testing only
// It bypasses the Stripe payment process
export async function POST(request: NextRequest) {
  // Verify this is a test environment or localhost
  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const isTestEnvironment = process.env.NODE_ENV === 'development' || 
                            process.env.TESTING_MODE === 'true';
  
  if (!isLocalhost && !isTestEnvironment) {
    return NextResponse.json(
      { error: 'This endpoint is only available in testing environments' },
      { status: 403 }
    );
  }

  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { cvId } = body;
    // Fixed job count at 25
    const jobCount = 25;

    if (!cvId) {
      return NextResponse.json(
        { error: 'CV ID is required' },
        { status: 400 }
      );
    }
    
    // Get the user's team - still needed for team context
    const userTeam = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    if (userTeam.length === 0) {
      return NextResponse.json(
        { error: 'User is not associated with any team' },
        { status: 400 }
      );
    }

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, userTeam[0].teamId))
      .limit(1);

    if (team.length === 0) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 400 }
      );
    }

    // Fetch CV content using cvId
    // In a real implementation, this would retrieve the actual CV content
    // For this testing purpose, let's create a simple CV text
    const cvContent = `
Professional Summary:
Experienced software engineer with 5+ years building web applications using React, Node.js, and TypeScript.

Skills:
- JavaScript, TypeScript, Python
- React, Next.js, Node.js, Express
- PostgreSQL, MongoDB
- AWS, Docker, CI/CD

Experience:
Software Engineer - Tech Corp (2020-Present)
- Developed responsive web applications using React and Next.js
- Implemented RESTful APIs using Node.js and Express
- Collaborated with cross-functional teams to deliver features on schedule

Front-end Developer - Web Solutions Inc (2018-2020)
- Built interactive user interfaces with React and Redux
- Optimized application performance reducing load time by 30%
- Mentored junior developers on best practices

Education:
Bachelor of Science in Computer Science - State University (2018)
    `;

    // Skip the Stripe payment process but generate a mock payment ID
    const mockPaymentId = `test_${crypto.randomUUID()}`;
    
    console.log(`TESTING MODE: Creating mock payment intent with ID: ${mockPaymentId}`);

    // Create a record in the job_applications table marked as a test
    await sql`
      INSERT INTO job_applications (
        user_id, team_id, cv_id, job_count, status, amount_charged, 
        payment_status, payment_intent_id, metadata
      ) VALUES (
        ${user.id}, ${team[0].id}, ${cvId}, ${jobCount}, 'pending', 0, 
        'test_mode', ${mockPaymentId}, ${JSON.stringify({ 
          jobCount: jobCount, 
          startedAt: new Date().toISOString(),
          isTestMode: true
        })}
      )
    `;

    // Call the job application agent asynchronously
    setTimeout(async () => {
      try {
        console.log(`TESTING MODE: Running job application agent for test ID: ${mockPaymentId}`);
        
        // Write CV to temporary file for the Python script to process
        const cvTempFilePath = await writeTempFile(cvContent, 'cv');
        
        // Path to the Python agent
        const pythonScript = path.join(process.cwd(), 'app', '(dashboard)', 'dashboard', 'apply', 'agent', 'agent.py');
        
        // Prepare the Python command
        const pythonCommand = `python "${pythonScript}" "${cvTempFilePath}" ${jobCount}`;
        
        console.log(`Executing command: ${pythonCommand}`);
        
        // Execute the Python agent
        let result;
        try {
          result = await execPromise(pythonCommand);
          console.log('Python agent output:', result.stdout);
          if (result.stderr) {
            console.error('Python agent stderr:', result.stderr);
          }
        } catch (error) {
          console.error('Error executing Python agent:', error);
          result = { stdout: JSON.stringify({ error: 'Failed to execute agent' }), stderr: '' };
        }
        
        // Parse the agent output (assuming it returns JSON)
        let agentResults;
        try {
          agentResults = JSON.parse(result.stdout);
        } catch (error) {
          console.error('Error parsing agent output:', error);
          agentResults = { 
            status: 'error',
            error: 'Failed to parse agent output',
            rawOutput: result.stdout
          };
        }
        
        // Clean up the temporary file
        try {
          await fs.unlink(cvTempFilePath);
        } catch (error) {
          console.error('Error deleting temp file:', error);
        }
        
        // Update the job status with the agent results
        await sql`
          UPDATE job_applications 
          SET status = 'completed', 
              updated_at = NOW(),
              payment_status = 'test_completed',
              metadata = ${JSON.stringify({ 
                jobCount: jobCount, 
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                appliedJobs: jobCount,
                successfulApplications: Math.floor(jobCount * 0.9),
                failedApplications: Math.floor(jobCount * 0.1),
                isTestMode: true,
                testResults: {
                  apiCallsMade: 5, // This would be derived from agent output in a real implementation
                  tokensUsed: 12500, // This would be derived from agent output in a real implementation
                  costEstimate: "$0.25", // This would be derived from agent output in a real implementation
                  completionTime: "00:03:45", // This would be derived from agent output in a real implementation
                  agentOutput: agentResults
                }
              })}
          WHERE payment_intent_id = ${mockPaymentId}
        `;

        console.log(`TESTING MODE: Job application ${mockPaymentId} completed successfully`);
      } catch (error) {
        console.error('Error completing test job application:', error);
      }
    }, 5000);

    // Return success with test mode indicator
    return NextResponse.json({
      success: true,
      message: 'Job application process started (TEST MODE)',
      jobCount,
      testMode: true,
      mockPaymentId
    });
  } catch (error) {
    console.error('Error starting test job application process:', error);
    return NextResponse.json(
      { error: 'Failed to start test job application process' },
      { status: 500 }
    );
  }
} 