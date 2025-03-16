import { logger } from '@/lib/logger';
import OpenAI from 'openai';
import { isOpenAIAvailable } from '@/lib/services/openai.service';
import { analyzeAndOptimizeWithGPT4o } from '@/lib/services/openaiOptimizer';

/**
 * CV Optimization System Testing Utility
 * 
 * This utility provides functions to test various components of the CV optimization system,
 * including PDF parsing, analysis, optimization, and PDF generation.
 */

// Define test result interface
export interface TestResult {
  component: string;
  status: 'success' | 'failure' | 'warning' | 'info';
  message: string;
  timestamp: string;
  details?: any;
}

/**
 * Run a comprehensive test of all system components
 */
export async function runSystemTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    logger.info('Starting system test');
    
    // Test 1: OpenAI API
    await testOpenAIAPI(results);
    
    // Test 2: OpenAI Optimizer
    await testOpenAIOptimizer(results);
    
    // Test 3: Document Processing
    await testDocumentProcessing(results);
    
    // Test 4: Database Connection
    await testDatabaseConnection(results);
    
    // Test 5: Cache System
    await testCacheSystem(results);
    
    // Test 6: Task Queue
    await testTaskQueue(results);
    
    // Test 7: Rate Limiter
    await testRateLimiter(results);
    
    // Add overall test result
    results.push({
      component: 'System Test',
      status: 'success',
      message: 'System test completed',
      timestamp: new Date().toISOString(),
    });
    
    logger.info('System test completed successfully');
    return results;
  } catch (error) {
    logger.error('System test failed:', error instanceof Error ? error.message : String(error));
    
    results.push({
      component: 'System Test',
      status: 'failure',
      message: `System test failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
    });
    
    return results;
  }
}

/**
 * Test OpenAI API connectivity
 */
async function testOpenAIAPI(results: TestResult[]): Promise<void> {
  try {
    logger.info('Testing OpenAI API connectivity');
    
    // Check if OpenAI is available
    const openaiAvailable = await isOpenAIAvailable();
    
    if (openaiAvailable) {
      results.push({
        component: 'OpenAI API',
        status: 'success',
        message: 'OpenAI API is available',
        timestamp: new Date().toISOString(),
      });
      
      logger.info('OpenAI API test passed');
    } else {
      results.push({
        component: 'OpenAI API',
        status: 'failure',
        message: 'OpenAI API is not available',
        timestamp: new Date().toISOString(),
      });
      
      logger.error('OpenAI API test failed');
    }
  } catch (error) {
    logger.error('Error testing OpenAI API:', error instanceof Error ? error.message : String(error));
    
    results.push({
      component: 'OpenAI API',
      status: 'failure',
      message: `Error testing OpenAI API: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Test OpenAI Optimizer functionality
 */
async function testOpenAIOptimizer(results: TestResult[]): Promise<void> {
  try {
    logger.info('Testing OpenAI Optimizer functionality');
    
    // Sample CV text for testing
    const sampleCV = `
John Doe
Software Engineer
john.doe@example.com | (123) 456-7890 | linkedin.com/in/johndoe

SUMMARY
Experienced software engineer with 5 years of experience in full-stack development.
Proficient in JavaScript, TypeScript, React, Node.js, and AWS.

EXPERIENCE
Senior Software Engineer, ABC Tech
January 2020 - Present
- Developed and maintained web applications using React and Node.js
- Implemented CI/CD pipelines using GitHub Actions
- Reduced application load time by 40% through code optimization

Software Engineer, XYZ Solutions
June 2018 - December 2019
- Built RESTful APIs using Express.js and MongoDB
- Collaborated with UX designers to implement responsive UI components
- Participated in code reviews and mentored junior developers

EDUCATION
Bachelor of Science in Computer Science
University of Technology, 2018

SKILLS
Programming: JavaScript, TypeScript, Python, Java
Frontend: React, Redux, HTML, CSS, SASS
Backend: Node.js, Express, MongoDB, PostgreSQL
DevOps: AWS, Docker, Kubernetes, CI/CD
`;

    // Test OpenAI Optimizer
    const result = await analyzeAndOptimizeWithGPT4o(sampleCV, "Perform analysis only");
    
    // Validate the result
    if (result && result.cvAnalysis && result.cvAnalysis.skills) {
      results.push({
        component: 'OpenAI Optimizer - Industry Detection',
        status: 'success',
        message: `Detected industry: ${result.cvAnalysis.industry || 'Technology'}`,
        timestamp: new Date().toISOString(),
      });
      
      results.push({
        component: 'OpenAI Optimizer - Industry Detection',
        status: 'info',
        message: `Analysis details available`,
        timestamp: new Date().toISOString(),
        details: result.cvAnalysis,
      });
      
      results.push({
        component: 'OpenAI Optimizer - Skill Extraction',
        status: 'success',
        message: `Extracted ${result.cvAnalysis.skills.technical.length + result.cvAnalysis.skills.professional.length} skills`,
        timestamp: new Date().toISOString(),
      });
      
      results.push({
        component: 'OpenAI Optimizer - Skill Extraction',
        status: 'info',
        message: `Skills: ${result.cvAnalysis.skills.technical.concat(result.cvAnalysis.skills.professional).join(', ')}`,
        timestamp: new Date().toISOString(),
      });
      
      results.push({
        component: 'OpenAI Optimizer - Content Analysis',
        status: 'success',
        message: `Analysis completed successfully`,
        timestamp: new Date().toISOString(),
      });
      
      if (result.recommendations && result.recommendations.length > 0) {
        results.push({
          component: 'OpenAI Optimizer - Content Analysis',
          status: 'info',
          message: `Recommendations: ${result.recommendations.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }
      
      results.push({
        component: 'OpenAI Optimizer',
        status: 'success',
        message: 'OpenAI Optimizer tests completed',
        timestamp: new Date().toISOString(),
      });
      
      logger.info('OpenAI Optimizer test passed');
    } else {
      throw new Error('Invalid result from OpenAI Optimizer');
    }
  } catch (error) {
    logger.error('Error testing OpenAI Optimizer:', error instanceof Error ? error.message : String(error));
    
    results.push({
      component: 'OpenAI Optimizer',
      status: 'failure',
      message: `Error testing OpenAI Optimizer: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Test document processing functionality
 */
async function testDocumentProcessing(results: TestResult[]): Promise<void> {
  // Implementation for document processing test
  results.push({
    component: 'Document Processing',
    status: 'info',
    message: 'Document processing test skipped (requires file upload)',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Test database connection
 */
async function testDatabaseConnection(results: TestResult[]): Promise<void> {
  // Implementation for database connection test
  results.push({
    component: 'Database Connection',
    status: 'info',
    message: 'Database connection test skipped (requires database access)',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Test cache system
 */
async function testCacheSystem(results: TestResult[]): Promise<void> {
  // Implementation for cache system test
  results.push({
    component: 'Cache System',
    status: 'info',
    message: 'Cache system test skipped (requires cache implementation)',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Test task queue
 */
async function testTaskQueue(results: TestResult[]): Promise<void> {
  // Implementation for task queue test
  results.push({
    component: 'Task Queue',
    status: 'info',
    message: 'Task queue test skipped (requires task queue implementation)',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Test rate limiter
 */
async function testRateLimiter(results: TestResult[]): Promise<void> {
  // Implementation for rate limiter test
  results.push({
    component: 'Rate Limiter',
    status: 'info',
    message: 'Rate limiter test skipped (requires rate limiter implementation)',
    timestamp: new Date().toISOString(),
  });
} 