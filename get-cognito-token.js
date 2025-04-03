const AWS = require('aws-sdk');
const crypto = require('crypto');

// Configure AWS SDK
AWS.config.update({
  region: 'eu-north-1'
});

// Cognito configuration
const CLIENT_ID = '2ch1vr3hl90lp2iaelstn8bmbs';
const CLIENT_SECRET = '1olkeuaficga2m3i7opf7lsftn223nb9tmrsoe106bvhl5u92kf6';
const USER_POOL_ID = 'eu-north-1_7KX6v1p82'; // Add your user pool ID here
const USERNAME = '30acd98c-2021-70b8-0a22-99c3547da50c';
const PASSWORD = 'Ocque031202@';

// Create Cognito service object
const cognito = new AWS.CognitoIdentityServiceProvider();

// Calculate SECRET_HASH
function calculateSecretHash(username) {
  const message = username + CLIENT_ID;
  const hmac = crypto
    .createHmac('sha256', CLIENT_SECRET)
    .update(message)
    .digest('base64');
  return hmac;
}

// Function to authenticate and get token
async function getToken() {
  try {
    // Check if client secret is set
    if (!CLIENT_SECRET) {
      console.error('ERROR: You must set the CLIENT_SECRET value in the script');
      console.log('\nTo find your client secret:');
      console.log('1. Go to AWS Cognito Console: https://eu-north-1.console.aws.amazon.com/cognito/v2/idp/user-pools');
      console.log('2. Select your user pool');
      console.log('3. Go to "App integration" tab');
      console.log('4. Scroll down to "App clients and analytics"');
      console.log('5. Find your app client (ID: 2ch1vr3hl90lp2iaelstn8bmbs)');
      console.log('6. Click on "Show client secret"');
      console.log('7. Copy the secret and paste it in this script as CLIENT_SECRET value');
      console.log('\nNOTE: If no client secret is shown, your app client may have been created without a secret.');
      console.log('In that case, you may need to create a new app client with a secret by:');
      console.log('1. Click "Create app client"');
      console.log('2. Select "Confidential client" type');
      console.log('3. Make sure "Generate client secret" is checked');
      console.log('4. Complete the creation process and use the new client ID and secret');
      process.exit(1);
    }

    // Calculate the secret hash
    const secretHash = calculateSecretHash(USERNAME);

    // Set up authentication parameters for admin auth flow
    const params = {
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: USERNAME,
        PASSWORD: PASSWORD,
        SECRET_HASH: secretHash
      }
    };

    console.log('Authenticating with Cognito using admin auth flow...');
    
    // Make the authentication request using adminInitiateAuth
    const response = await cognito.adminInitiateAuth(params).promise();
    
    console.log('\nAuthentication successful! 🎉\n');
    console.log('IdToken:');
    console.log(response.AuthenticationResult.IdToken);
    console.log('\nAccessToken:');
    console.log(response.AuthenticationResult.AccessToken);
    console.log('\nRefreshToken:');
    console.log(response.AuthenticationResult.RefreshToken);
    
    console.log('\n-------------------------------------------------');
    console.log('For API Gateway requests, use this header:');
    console.log(`Authorization: ${response.AuthenticationResult.IdToken}`);
    console.log('-------------------------------------------------');
  } catch (err) {
    console.error('Authentication Error:', err.message);
    console.error('Error code:', err.code);
    
    if (err.code === 'NotAuthorizedException') {
      console.log('Check that your USERNAME, PASSWORD, and CLIENT_SECRET are correct');
    } else if (err.code === 'UserNotFoundException') {
      console.log('User not found. Check the USERNAME value.');
    } else {
      console.log('Error details:', err);
    }
  }
}

// Execute the function
getToken();

// Instructions for how to use this script:
/* 
USAGE INSTRUCTIONS:
1. Make sure you have Node.js installed
2. Install required packages: npm install aws-sdk crypto
3. Update USER_POOL_ID with your actual user pool ID
4. Run the script: node get-cognito-token.js
5. Use the returned token in your API requests
*/ 