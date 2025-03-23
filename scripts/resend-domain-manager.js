#!/usr/bin/env node

/**
 * Resend Domain Manager
 * 
 * This script helps manage domain verification with Resend.
 * It can add a domain, check verification status, and verify a domain.
 * 
 * Usage:
 *  - node scripts/resend-domain-manager.js add
 *  - node scripts/resend-domain-manager.js check
 *  - node scripts/resend-domain-manager.js verify
 */

const { Resend } = require('resend');
require('dotenv').config();

const DOMAIN = 'resuming.ai';
const REGION = 'us-east-1'; // Default region or change as needed

// Check if API key is available
if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set in the environment variables.');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function addDomain() {
  console.log(`🔹 Adding domain ${DOMAIN} to Resend...`);
  
  try {
    const domain = await resend.domains.create({
      name: DOMAIN,
      region: REGION,
    });
    
    if (domain.error) {
      console.error(`❌ Error adding domain: ${domain.error.message}`);
      return;
    }
    
    console.log('✅ Domain added successfully!');
    console.log('\nPlease add the following DNS records to your domain:');
    
    if (domain.data.records) {
      domain.data.records.forEach(record => {
        console.log(`\n${record.type} Record:`);
        console.log(`  Host/Name: ${record.name}`);
        console.log(`  Value/Content: ${record.value}`);
        console.log(`  TTL: ${record.ttl || 'Auto/3600'}`);
      });
    }
    
    console.log('\nAfter adding these records, run `node scripts/resend-domain-manager.js verify` to verify your domain.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function checkDomain() {
  console.log(`🔹 Checking domain ${DOMAIN} status...`);
  
  try {
    const domains = await resend.domains.list();
    
    if (domains.error) {
      console.error(`❌ Error checking domains: ${domains.error.message}`);
      return;
    }
    
    const domain = domains.data.find(d => d.name === DOMAIN);
    
    if (!domain) {
      console.log(`❓ Domain ${DOMAIN} not found. Add it with \`node scripts/resend-domain-manager.js add\``);
      return;
    }
    
    console.log(`Domain: ${domain.name}`);
    console.log(`Status: ${domain.status}`);
    console.log(`Region: ${domain.region}`);
    console.log(`Created: ${new Date(domain.created_at).toLocaleString()}`);
    
    if (domain.status === 'not_started') {
      console.log('\n⚠️ Domain needs to be verified. Run `node scripts/resend-domain-manager.js add` to get DNS records.');
    } else if (domain.status === 'verified') {
      console.log('\n✅ Domain is verified and ready to use!');
    } else {
      console.log('\n⏳ Domain verification is in progress or has issues.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function verifyDomain() {
  console.log(`🔹 Verifying domain ${DOMAIN}...`);
  
  try {
    const response = await resend.domains.verify(DOMAIN);
    
    if (response.error) {
      console.error(`❌ Error verifying domain: ${response.error.message}`);
      return;
    }
    
    console.log('Domain verification initiated.');
    console.log(`Status: ${response.data.status}`);
    
    if (response.data.status === 'verified') {
      console.log('✅ Domain is verified and ready to use!');
    } else {
      console.log('⏳ Domain verification is still in progress.');
      console.log('This can take some time as DNS propagation occurs.');
      console.log('Run `node scripts/resend-domain-manager.js check` later to check the status.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main execution
const command = process.argv[2];

if (!command) {
  console.log('Please provide a command: add, check, or verify');
  process.exit(1);
}

switch (command.toLowerCase()) {
  case 'add':
    addDomain();
    break;
  case 'check':
    checkDomain();
    break;
  case 'verify':
    verifyDomain();
    break;
  default:
    console.log('Unknown command. Use add, check, or verify');
    process.exit(1);
} 