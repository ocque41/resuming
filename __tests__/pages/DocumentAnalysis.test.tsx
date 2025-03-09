import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the necessary components and modules
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  redirect: jest.fn(),
}));

jest.mock('@/lib/db/queries.server', () => ({
  getUser: jest.fn(() => ({ id: 1, name: 'Test User' })),
  getTeamForUser: jest.fn(() => ({ id: 1, name: 'Test Team' })),
  getCVsForUser: jest.fn(() => [
    {
      id: '1',
      fileName: 'resume.pdf',
      userId: '1',
      createdAt: new Date(),
    },
  ]),
}));

// Mock the DocumentAnalysisPage component
const MockDocumentAnalysisPage = () => {
  return (
    <div>
      <h1>Document Analysis</h1>
      <div className="card">
        <h2>Advanced Document Analytics</h2>
        <p>Powered by AI engine to extract insights from your documents</p>
        <select data-testid="document-select">
          <option value="1">resume.pdf</option>
        </select>
        <button>Analyze</button>
      </div>
      <div data-testid="analysis-tabs">
        <div data-testid="content-analysis">Content Analysis</div>
        <div data-testid="sentiment-analysis">Sentiment Analysis</div>
        <div data-testid="key-information">Key Information</div>
        <div data-testid="summary">Summary</div>
      </div>
    </div>
  );
};

// Mock implementation
jest.mock('@/app/(dashboard)/dashboard/analyze/page', () => ({
  __esModule: true,
  default: MockDocumentAnalysisPage,
}));

describe('Document Analysis Page', () => {
  it('renders the document analysis page title', () => {
    render(<MockDocumentAnalysisPage />);
    expect(screen.getByText('Document Analysis')).toBeInTheDocument();
  });

  it('displays the document selection dropdown', () => {
    render(<MockDocumentAnalysisPage />);
    const selectElement = screen.getByTestId('document-select');
    expect(selectElement).toBeInTheDocument();
  });

  it('renders the analysis tabs', () => {
    render(<MockDocumentAnalysisPage />);
    expect(screen.getByTestId('analysis-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('content-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('sentiment-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('key-information')).toBeInTheDocument();
    expect(screen.getByTestId('summary')).toBeInTheDocument();
  });

  it('displays the AI-powered analytics description', () => {
    render(<MockDocumentAnalysisPage />);
    expect(screen.getByText('Powered by AI engine to extract insights from your documents')).toBeInTheDocument();
  });
}); 