const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Installing dependencies for AI Document Assistant...');

// Function to check if the package is already installed
function isPackageInstalled(packageName) {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    return (
      (packageJson.dependencies && packageJson.dependencies[packageName]) ||
      (packageJson.devDependencies && packageJson.devDependencies[packageName])
    );
  } catch (error) {
    console.error('Error checking if package is installed:', error);
    return false;
  }
}

// Install client dependencies
const clientDependencies = [
  '@aws-sdk/client-s3',
  '@aws-sdk/s3-request-presigner',
  'react-dropzone',
  'uuid',
  'clsx',
  'tailwind-merge',
  '@radix-ui/react-avatar',
  '@radix-ui/react-toast',
  '@radix-ui/react-tabs',
  '@radix-ui/react-progress',
  '@radix-ui/react-scroll-area',
  'class-variance-authority',
  'lucide-react',
];

// Filter out already installed dependencies
const missingClientDependencies = clientDependencies.filter(pkg => !isPackageInstalled(pkg));

if (missingClientDependencies.length > 0) {
  console.log('Installing client dependencies:', missingClientDependencies.join(', '));
  try {
    execSync(`npm install ${missingClientDependencies.join(' ')}`, { stdio: 'inherit' });
    console.log('Client dependencies installed successfully!');
  } catch (error) {
    console.error('Error installing client dependencies:', error);
  }
} else {
  console.log('All client dependencies are already installed!');
}

// Check if Python dependencies need to be installed
const pythonRequirementsPath = path.join(process.cwd(), 'python_backend', 'requirements.txt');
if (fs.existsSync(pythonRequirementsPath)) {
  console.log('Installing Python dependencies...');
  try {
    // Check if python_backend directory exists
    const pythonBackendDir = path.join(process.cwd(), 'python_backend');
    if (!fs.existsSync(pythonBackendDir)) {
      fs.mkdirSync(pythonBackendDir, { recursive: true });
      console.log('Created python_backend directory');
    }
    
    // Install Python dependencies
    execSync('pip install -r python_backend/requirements.txt', { stdio: 'inherit' });
    console.log('Python dependencies installed successfully!');
  } catch (error) {
    console.error('Error installing Python dependencies:', error);
  }
} else {
  console.log('Python requirements file not found. Skipping Python dependencies installation.');
}

console.log('All dependencies installed. You can now start the application with:');
console.log('npm run dev'); 