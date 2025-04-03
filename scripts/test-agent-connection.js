/**
 * Test script to verify the agent connection
 * 
 * This script sends a simple "Hello" message to the agent API
 * and validates that we get a proper response.
 * 
 * Usage: node scripts/test-agent-connection.js
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const AGENT_ENDPOINT = `${BASE_URL}/api/agent`;
const TEST_MESSAGE = 'Hello';

async function testAgentConnection() {
  console.log('Testing AI Agent connection...');
  console.log(`Endpoint: ${AGENT_ENDPOINT}`);
  console.log(`Message: "${TEST_MESSAGE}"`);
  console.log('------------------------------');

  try {
    const response = await fetch(AGENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: TEST_MESSAGE,
        mode: 'create', // Use create mode for simple greetings
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Success! Agent responded:');
      console.log('------------------------------');
      console.log(data.response ? data.response.substring(0, 200) + '...' : JSON.stringify(data, null, 2));
      
      if (data.mockResponse) {
        console.warn('\n⚠️  WARNING: Received a mock response. Lambda endpoint may not be configured correctly.');
      } else {
        console.log('\n✅ Agent connection verified successfully!');
      }
    } else {
      console.error('Error from agent API:');
      console.error(data.error || 'Unknown error');
      
      // Check if it's a configuration error
      if (data.error && data.error.includes('endpoint not configured')) {
        console.error('\n❌ Lambda endpoint not properly configured.');
        console.error('Check your environment variables:');
        console.error('- AWS_LAMBDA_AI_AGENT_ENDPOINT');
        console.error('- NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT');
      }
    }
  } catch (error) {
    console.error('Connection error:');
    console.error(error.message);
    console.error('\n❌ Failed to connect to the agent API. Check if the server is running.');
  }
}

// Run the test
testAgentConnection().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
}); 