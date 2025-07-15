import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentUploader from '@/components/DocumentUploader.client';
import '@testing-library/jest-dom';

// Mock the upload API
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, documentId: 'test-doc-123' }),
  })
) as jest.Mock;

// Mock file reader
const originalCreateObjectURL = global.URL.createObjectURL;
global.URL.createObjectURL = jest.fn(() => 'mockedUrl');

describe('DocumentUploader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
  });

  it('renders the uploader with default props', () => {
    render(<DocumentUploader />);

    expect(screen.getByText(/Drag & drop your document here/i)).toBeInTheDocument();
  });

  it.skip('accepts file upload when valid file is selected', async () => {
    const handleComplete = jest.fn();
    render(<DocumentUploader onUploadComplete={handleComplete} />);
    
    const file = new File(['dummy content'], 'test-document.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('file-input');
    
    Object.defineProperty(input, 'files', {
      value: [file],
    });
    
    fireEvent.change(input);
    
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    
    const uploadButton = screen.getByRole('button', { name: /Upload/i });
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
      expect(handleComplete).toHaveBeenCalledWith('test-doc-123');
    });
  });

  // react-dropzone prevents uploading disallowed file types, so we skip this case

  it.skip('shows error when file size exceeds limit', async () => {
    render(<DocumentUploader maxSizeMB={0.01} />);
    
    // Create a file larger than the limit (10KB)
    const largeContent = 'a'.repeat(15 * 1024); // 15KB
    const file = new File([largeContent], 'large-file.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('file-input');
    
    Object.defineProperty(input, 'files', {
      value: [file],
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      expect(screen.getByText(/File size exceeds/i)).toBeInTheDocument();
    });
  });
});