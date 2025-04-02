// Simple test script to verify AI Agent API with "Hello" message
// Run with: node test-hello.js

async function testAgentAPI() {
  try {
    console.log('Testing AI Agent API with "Hello" message...');
    
    const response = await fetch('http://localhost:3000/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello',
        mode: 'create',
        // No documentId or s3Key provided for testing simple greeting
      }),
      credentials: 'include', // Include cookies for auth
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Error response:', await response.text());
      return;
    }
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (data.response) {
      console.log('\nAI Response:');
      console.log('-----------');
      console.log(data.response);
      console.log('-----------');
    } else {
      console.error('No response content received');
    }
    
    console.log('\nTest completed.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAgentAPI(); 