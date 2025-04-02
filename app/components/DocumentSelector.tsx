'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { FileText, FolderOpen } from 'lucide-react';

export type Document = {
  id: string;
  name: string;
  type: string;
};

interface DocumentSelectorProps {
  selectedDocument: Document | null;
  onDocumentSelect: (document: Document | null) => void;
  required?: boolean;
}

export default function DocumentSelector({ 
  selectedDocument,
  onDocumentSelect,
  required = false 
}: DocumentSelectorProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch documents on mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        // This would typically be an API call
        // For now, we'll use mock data
        const mockDocuments: Document[] = [
          { id: '1', name: 'Resume.pdf', type: 'pdf' },
          { id: '2', name: 'Cover Letter.docx', type: 'docx' },
          { id: '3', name: 'Notes.txt', type: 'txt' },
        ];
        
        setDocuments(mockDocuments);
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const handleDocumentChange = (value: string) => {
    if (value === '') {
      onDocumentSelect(null);
      return;
    }

    const selectedDoc = documents.find(doc => doc.id === value) || null;
    onDocumentSelect(selectedDoc);
  };

  return (
    <div className="flex items-center space-x-2">
      <Select 
        value={selectedDocument?.id || ''} 
        onValueChange={handleDocumentChange}
      >
        <SelectTrigger 
          className="w-[250px]"
          disabled={loading}
        >
          <div className="flex items-center">
            {selectedDocument ? (
              <>
                <FileText className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select a document" />
              </>
            ) : (
              <>
                <FolderOpen className="h-4 w-4 mr-2" />
                <span className="text-muted-foreground">{required ? "Select a document (required)" : "Select a document (optional)"}</span>
              </>
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {!required && (
            <SelectItem value="">
              <span className="text-muted-foreground">No document</span>
            </SelectItem>
          )}
          {documents.map(doc => (
            <SelectItem key={doc.id} value={doc.id}>
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                <span>{doc.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 