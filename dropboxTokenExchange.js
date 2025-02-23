// dropboxTokenExchange.js
const fetch = require("node-fetch");
const querystring = require("querystring");

// Replace these with your actual values:
const authorizationCode = "1oJhHuYYYXQAAAAAAAAATc9fNkRq7NJHE3p3EiZFxqo"; // e.g., the code you received in the redirect
const clientId = "6mh93kynicr288f";
const clientSecret = "8nwccfvornpuet0";
const redirectUri = "https://next-js-saas-starter-three-resuming.vercel.app/api/auth/dropbox/callback";

async function exchangeCodeForTokens() {
  const tokenUrl = "https://api.dropbox.com/oauth2/token";
  const body = querystring.stringify({
    code: authorizationCode,
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      console.error("Failed to exchange code:", response.statusText);
      const errorBody = await response.text();
      console.error("Error body:", errorBody);
      return;
    }

    const data = await response.json();
    console.log("Token Exchange Successful:");
    console.log("Access Token:", data.access_token);
    console.log("Refresh Token:", data.refresh_token);
    console.log("Expires In:", data.expires_in);
  } catch (error) {
    console.error("Error during token exchange:", error);
  }
}

exchangeCodeForTokens();
