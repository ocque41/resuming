# AI Document Analysis

## Overview

The document analysis feature uses OpenAI's GPT models to analyze CV documents and provide structured insights. This document explains how the feature works and its main components.

## Analysis Process Flow

1. **Request Initiation**: The process begins when a user selects a document in the UI and clicks "Analyze"
2. **Document Retrieval**: The API fetches the document from the database using the document ID
3. **AI Processing**: The document text is sent to OpenAI's API for analysis
4. **Result Structure**: The AI responses are formatted into a consistent structure
5. **Database Storage**: Analysis results are saved to the CV's metadata in the database
6. **UI Display**: Results are returned to the frontend and displayed in the UI

## Analysis Components

The analysis is divided into four main components:

### 1. Content Analysis
- Content distribution (percentage breakdown by section type)
- Top keywords with importance scores

### 2. Sentiment Analysis
- Overall sentiment score from 0 to 1
- Section-by-section sentiment analysis

### 3. Key Information Extraction
- Contact information detection
- Key dates identification
- Entity recognition (organizations, skills, etc.)

### 4. Document Summary
- Key highlights extraction
- Improvement suggestions
- Overall document quality score

## Implementation Details

### AI Service
The core AI functionality is implemented in `lib/ai/document-analysis.ts`, which contains:
- `analyzeDocumentWithAI`: The main function that orchestrates the analysis
- Helper functions for each analysis component that create targeted prompts

### API Endpoint
The API endpoint is at `app/api/document/analyze/route.ts` and handles:
- Document retrieval from the database
- Calling the AI service
- Storing results back to the database
- Error handling and fallbacks

### Frontend Component
The UI is handled by `components/DocumentAnalyzer.client.tsx`, which:
- Provides document selection
- Handles the API request/response
- Displays loading states and errors
- Renders visualizations of the analysis results

## Error Handling and Fallbacks

If the AI analysis fails for any reason, the system falls back to using mock data to ensure the UI still displays something meaningful. Common failure scenarios include:

- Missing document text
- OpenAI API errors
- Parsing errors in the AI response

## Response Format

The analysis result follows this structure:

```typescript
{
  documentId: string | number,
  fileName: string,
  analysisType: string,
  analysisTimestamp: string,
  contentAnalysis: {
    contentDistribution: Array<{name: string, value: number}>,
    topKeywords: Array<{text: string, value: number}>
  },
  sentimentAnalysis: {
    overallScore: number,
    sentimentBySection: Array<{section: string, score: number}>
  },
  keyInformation: {
    contactInfo: Array<{type: string, value: string}>,
    keyDates: Array<{description: string, date: string}>,
    entities: Array<{type: string, name: string, occurrences: number}>
  },
  summary: {
    highlights: string[],
    suggestions: string[],
    overallScore: number
  }
}
```

## Potential Improvements

Future enhancements could include:
- More detailed content analysis
- Dedicated database schema for analysis results
- Comparison between multiple document versions
- Historical trend analysis for document improvements
- Integration with industry benchmarks 