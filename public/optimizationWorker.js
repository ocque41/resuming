// Web Worker for CV optimization heavy computations

// Simulate analyzing CV content
function analyzeCV(cvText) {
  // Simulate heavy computation
  console.log('Worker: Analyzing CV content...');
  
  // Parse the CV text
  const sections = extractSections(cvText);
  
  // Calculate ATS score
  const atsScore = calculateATSScore(sections);
  
  // Find keywords
  const keywords = extractKeywords(sections);
  
  // Return analysis results
  return {
    atsScore,
    keywords,
    sections,
    analysisComplete: true
  };
}

// Simulate extracting sections from CV
function extractSections(cvText) {
  // Simulate section extraction
  console.log('Worker: Extracting sections...');
  
  // In a real implementation, this would parse the CV text into sections
  const sections = {
    profile: "Professional with experience in...",
    experience: "Senior role at...",
    education: "University degree in...",
    skills: "Project management, leadership...",
  };
  
  return sections;
}

// Simulate calculating ATS score
function calculateATSScore(sections) {
  // Simulate score calculation
  console.log('Worker: Calculating ATS score...');
  
  // In a real implementation, this would analyze the sections against ATS criteria
  let score = 65; // Base score
  
  // Simulate heavy computation with a loop
  for (let i = 0; i < 1000000; i++) {
    // Intentionally heavy computation
    score = (score + Math.random() * 20) % 100;
  }
  
  return Math.round(score);
}

// Simulate extracting keywords
function extractKeywords(sections) {
  // Simulate keyword extraction
  console.log('Worker: Extracting keywords...');
  
  // In a real implementation, this would identify important keywords in the CV
  const keywords = [
    "project management",
    "leadership",
    "strategic planning",
    "team building",
    "data analysis",
    "communication",
    "problem solving",
    "budget management"
  ];
  
  return keywords;
}

// Simulate optimizing CV content
function optimizeCV(cvData) {
  console.log('Worker: Optimizing CV content...');
  
  // Simulate optimization process
  const { cvText, template, originalScore } = cvData;
  
  // Simulate heavy computation
  let optimizedText = cvText;
  let optimizedScore = originalScore;
  
  // Simulate improvements
  for (let i = 0; i < 500000; i++) {
    // Intentionally heavy computation
    optimizedScore = Math.min(95, optimizedScore + (Math.random() * 0.1));
  }
  
  return {
    optimizedText,
    optimizedScore: Math.round(optimizedScore),
    template,
    optimizationComplete: true
  };
}

// Listen for messages from the main thread
self.onmessage = function(e) {
  console.log('Worker: Message received from main script');
  
  const { action, data } = e.data;
  
  switch (action) {
    case 'analyze':
      const analysisResult = analyzeCV(data.cvText);
      self.postMessage({ action: 'analysisComplete', result: analysisResult });
      break;
      
    case 'optimize':
      const optimizationResult = optimizeCV(data);
      self.postMessage({ action: 'optimizationComplete', result: optimizationResult });
      break;
      
    default:
      self.postMessage({ action: 'error', error: 'Unknown action' });
  }
}; 