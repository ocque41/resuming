// Simple script to clean up test files that are no longer needed
// Run with: node delete-test-files.js

const fs = require('fs');
const path = require('path');

const filesToDelete = [
  'test-hello.js',
  'SimpleAITest.tsx',
  'app/test-ai/page.tsx'
];

console.log('Cleaning up test files...');

filesToDelete.forEach(filePath => {
  try {
    // Check if file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath);
      console.log(`✓ Deleted: ${filePath}`);
    } else {
      console.log(`⚠ File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`✗ Error deleting ${filePath}:`, error.message);
  }
});

// Try to remove the test-ai directory if it exists and is empty
try {
  const testAiDir = 'app/test-ai';
  if (fs.existsSync(testAiDir)) {
    const files = fs.readdirSync(testAiDir);
    if (files.length === 0) {
      fs.rmdirSync(testAiDir);
      console.log(`✓ Removed directory: ${testAiDir}`);
    } else {
      console.log(`⚠ Directory not empty: ${testAiDir}`);
    }
  }
} catch (error) {
  console.error('✗ Error removing directory:', error.message);
}

console.log('Cleanup complete.'); 