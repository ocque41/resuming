require('dotenv').config();
const { exec } = require('child_process');
const readline = require('readline');
const { Resend } = require('resend');
const fetch = require('node-fetch');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Resend client
if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY environment variable is not set');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Check if domain is properly configured with Resend
 */
async function checkDomainStatus() {
  console.log('\n=== Checking Domain Status ===');
  
  try {
    // Get domain list
    const { data: domains, error } = await resend.domains.list();
    
    if (error) {
      console.error('❌ Error fetching domains:', error);
      return false;
    }
    
    if (domains.length === 0) {
      console.error('❌ No domains found. Please add resuming.ai domain with: node scripts/resend-domain-manager.js add');
      return false;
    }
    
    const resumingDomain = domains.find(d => d.name === 'resuming.ai');
    
    if (!resumingDomain) {
      console.error('❌ resuming.ai domain not found. Please add it with: node scripts/resend-domain-manager.js add');
      return false;
    }
    
    if (resumingDomain.status !== 'verified') {
      console.error(`❌ resuming.ai domain is not verified (status: ${resumingDomain.status}). Please verify with: node scripts/resend-domain-manager.js verify`);
      return false;
    }
    
    console.log('✅ resuming.ai domain is properly verified with Resend');
    return true;
  } catch (error) {
    console.error('❌ Exception checking domain status:', error);
    return false;
  }
}

/**
 * Check environment variables required for email verification
 */
function checkEnvironmentVariables() {
  console.log('\n=== Checking Environment Variables ===');
  
  const requiredVars = [
    'POSTGRES_URL',
    'RESEND_API_KEY',
    'BASE_URL',
    'AUTH_SECRET',
  ];
  
  let allVarsFound = true;
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`❌ ${varName} environment variable is not set`);
      allVarsFound = false;
    } else {
      console.log(`✅ ${varName} is set`);
    }
  });
  
  if (process.env.RESEND_FROM_EMAIL !== 'hi@resuming.ai') {
    console.warn(`⚠️ RESEND_FROM_EMAIL is not set to hi@resuming.ai. Current value: ${process.env.RESEND_FROM_EMAIL || 'not set'}`);
    console.warn('   Consider updating this in your .env file');
  } else {
    console.log('✅ RESEND_FROM_EMAIL is correctly set to hi@resuming.ai');
  }
  
  return allVarsFound;
}

/**
 * Check if database tables are properly set up
 */
function checkDatabaseTables() {
  console.log('\n=== Checking Database Tables ===');
  
  return new Promise((resolve) => {
    exec('npx drizzle-kit introspect:pg', (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error checking database schema: ${error.message}`);
        return resolve(false);
      }
      
      // Check for users and verification_tokens tables in output
      const hasUsersTable = stdout.includes('users');
      const hasVerificationTokensTable = stdout.includes('verification_tokens');
      const hasEmailVerifiedColumn = stdout.includes('email_verified');
      
      if (hasUsersTable) {
        console.log('✅ users table exists');
      } else {
        console.error('❌ users table not found');
      }
      
      if (hasVerificationTokensTable) {
        console.log('✅ verification_tokens table exists');
      } else {
        console.error('❌ verification_tokens table not found');
      }
      
      if (hasEmailVerifiedColumn) {
        console.log('✅ email_verified column exists in users table');
      } else {
        console.error('❌ email_verified column not found in users table');
      }
      
      return resolve(hasUsersTable && hasVerificationTokensTable && hasEmailVerifiedColumn);
    });
  });
}

/**
 * Check the verification endpoints to ensure they're properly implemented
 */
async function checkVerificationEndpoints() {
  console.log('\n=== Checking Verification Endpoints ===');
  
  try {
    // Check the resend-verification endpoint
    const resendEndpoint = `${BASE_URL}/api/resend-verification`;
    console.log(`Testing: ${resendEndpoint}`);
    
    try {
      const resendResponse = await fetch(resendEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' })
      });
      
      const resendData = await resendResponse.json();
      
      if (resendResponse.ok) {
        console.log('✅ /api/resend-verification endpoint working');
      } else {
        console.error(`❌ /api/resend-verification endpoint error: ${resendData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error testing /api/resend-verification endpoint:', error);
    }
    
    // Check the verify-email endpoint
    const verifyEndpoint = `${BASE_URL}/api/verify-email`;
    console.log(`Testing: ${verifyEndpoint}`);
    
    try {
      const verifyResponse = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', token: 'test-token' })
      });
      
      const verifyData = await verifyResponse.json();
      
      if (verifyResponse.status === 400 && verifyData.error === 'Invalid or expired verification token') {
        console.log('✅ /api/verify-email endpoint working (correctly rejected invalid token)');
      } else if (verifyResponse.ok) {
        console.log('✅ /api/verify-email endpoint working');
      } else {
        console.error(`❌ /api/verify-email endpoint error: ${verifyData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error testing /api/verify-email endpoint:', error);
    }
    
    // Check the verification-status endpoint
    const statusEndpoint = `${BASE_URL}/api/verification-status?email=test@example.com`;
    console.log(`Testing: ${statusEndpoint}`);
    
    try {
      const statusResponse = await fetch(statusEndpoint);
      
      if (statusResponse.ok) {
        console.log('✅ /api/verification-status endpoint working');
      } else {
        const statusData = await statusResponse.json();
        console.error(`❌ /api/verification-status endpoint error: ${statusData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error testing /api/verification-status endpoint:', error);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Exception checking verification endpoints:', error);
    return false;
  }
}

/**
 * Test email sending functionality
 */
async function testEmailSending() {
  console.log('\n=== Testing Email Sending ===');
  
  return new Promise((resolve) => {
    rl.question('Would you like to send a test verification email? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        rl.question('Enter an email address to send the test to: ', async (email) => {
          if (!email || !email.includes('@')) {
            console.error('❌ Invalid email address');
            return resolve(false);
          }
          
          try {
            console.log(`Sending test email to ${email}...`);
            
            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Verification System Test</h1>
                <p>This is a test email to verify the email sending system is working properly.</p>
                <p>If you received this email, the Resend email service is configured correctly for resuming.ai.</p>
              </div>
            `;
            
            const { data, error } = await resend.emails.send({
              from: `Resuming.ai <hi@resuming.ai>`,
              to: email,
              subject: 'Email Verification System Test',
              html: htmlContent,
            });
            
            if (error) {
              console.error('❌ Error sending test email:', error);
              return resolve(false);
            }
            
            console.log(`✅ Test email sent successfully! Email ID: ${data.id}`);
            
            // Check if email was delivered
            console.log('Waiting 5 seconds to check email status...');
            setTimeout(async () => {
              try {
                const { data: statusData, error: statusError } = await resend.emails.get(data.id);
                
                if (statusError) {
                  console.error('❌ Error checking email status:', statusError);
                } else {
                  console.log(`Email status: ${statusData.status}`);
                  if (statusData.status === 'delivered') {
                    console.log('✅ Email was delivered successfully!');
                  } else {
                    console.warn(`⚠️ Email status is ${statusData.status}`);
                  }
                }
              } catch (statusCheckError) {
                console.error('❌ Exception checking email status:', statusCheckError);
              }
              
              resolve(true);
            }, 5000);
          } catch (error) {
            console.error('❌ Exception sending test email:', error);
            resolve(false);
          }
        });
      } else {
        console.log('Skipping test email sending');
        resolve(true);
      }
    });
  });
}

/**
 * Main function to run all checks
 */
async function main() {
  console.log('===== Email Verification System Diagnostic =====');
  
  const envVarsOk = checkEnvironmentVariables();
  const domainOk = await checkDomainStatus();
  const dbTablesOk = await checkDatabaseTables();
  const endpointsOk = await checkVerificationEndpoints();
  const emailSendingOk = await testEmailSending();
  
  console.log('\n===== Diagnostic Summary =====');
  console.log(`Environment Variables: ${envVarsOk ? '✅' : '❌'}`);
  console.log(`Domain Configuration: ${domainOk ? '✅' : '❌'}`);
  console.log(`Database Tables: ${dbTablesOk ? '✅' : '❌'}`);
  console.log(`Verification Endpoints: ${endpointsOk ? '✅' : '❌'}`);
  console.log(`Email Sending: ${emailSendingOk ? '✅' : '❌'}`);
  
  if (envVarsOk && domainOk && dbTablesOk && endpointsOk && emailSendingOk) {
    console.log('\n✅ All checks passed! Email verification system appears to be working properly.');
  } else {
    console.log('\n⚠️ Some checks failed. Review the issues above and fix them to ensure proper email verification.');
    
    if (!domainOk) {
      console.log('\nSuggestion: Run the domain verification script:');
      console.log('1. node scripts/resend-domain-manager.js add');
      console.log('2. Configure DNS records as shown in the output');
      console.log('3. node scripts/resend-domain-manager.js verify');
    }
    
    if (!dbTablesOk) {
      console.log('\nSuggestion: Run the database migration:');
      console.log('npx ts-node lib/db/migrations/add-verification-tokens.ts');
    }
  }
  
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error in diagnostic script:', error);
  rl.close();
}); 