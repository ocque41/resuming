# CV Optimization System

This document describes the CV optimization system implemented in the Next.js SaaS starter project.

## Overview

The CV optimization system is an advanced workflow that leverages OpenAI's GPT-4o model to analyze, optimize, and format CVs/résumés. The system follows a comprehensive process flow:

1. **PDF Upload** - Users upload their CV in PDF format
2. **Text Extraction & Analysis** - The system extracts text and analyzes it with AI
3. **ATS Scoring** - Calculates an ATS score based on industry standards
4. **Content Optimization** - Generates optimized content with improved structure
5. **DOCX Generation** - Creates a well-formatted DOCX file
6. **PDF Conversion** - Converts the DOCX back to PDF for final delivery

## Setup Requirements

### Environment Variables

The system requires the following environment variables:

```env
# OpenAI API Key (required for AI analysis and optimization)
OPENAI_API_KEY=your_openai_api_key

# Optional: Document conversion API key (if using external conversion service)
DOCUMENT_CONVERSION_API_KEY=your_conversion_api_key
```

### System Reference File

The system uses a `system-reference.md` file in the project root that contains best practices for CV optimization. This file is crucial for providing accurate recommendations during the analysis process.

## API Endpoints

The system exposes the following API endpoints:

- `/api/cv/process` - Initiates CV processing with OpenAI
- `/api/cv/process/status` - Checks the status of CV processing
- `/api/cv/generate-enhanced-docx` - Generates optimized DOCX file
- `/api/cv/convert-to-pdf` - Converts DOCX to PDF

## Usage Flow

1. The user selects a CV from their uploaded files
2. The system processes the CV with AI analysis (this may take up to 2 minutes)
3. Once processing is complete, the user can generate an optimized DOCX file
4. The DOCX can be downloaded or converted to PDF
5. The user can download the final optimized PDF

## Component Integration

The system is integrated into the dashboard via the `EnhancedOptimizeCVCard` component, which provides a user-friendly interface for the entire CV optimization workflow.

## Technical Details

### Key Files

- `app/api/cv/process/route.ts` - Main processing API endpoint
- `lib/enhancedDocxGenerator.ts` - DOCX generation service
- `lib/docxToPdfConverter.ts` - PDF conversion service
- `components/EnhancedOptimizeCVCard.client.tsx` - UI component

### Data Flow

The system stores all metadata, including AI analysis results and optimization data, in the CV record's metadata field in the database. This approach ensures all information is persisted throughout the workflow.

## Extending the System

To extend the system:

1. Modify the OpenAI prompts in `app/api/cv/process/route.ts` to adjust analysis criteria
2. Update the DOCX templates in `lib/enhancedDocxGenerator.ts` to change formatting
3. Add more CV templates by creating additional formatting functions
4. Implement a real DOCX to PDF conversion service for production use

## Troubleshooting

- If OpenAI API calls fail, check your API key and usage limits
- For conversion issues, verify the file paths and formats
- If metadata isn't persisting, verify database write permissions 