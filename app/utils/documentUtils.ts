import { saveAs } from 'file-saver';

/**
 * Attempts to download a document using multiple methods
 * @param blob The document blob to download
 * @param filename The filename to use for the download
 * @returns A promise that resolves to true if the download was successful
 */
export const downloadDocument = async (
  blob: Blob, 
  filename: string
): Promise<boolean> => {
  // Try multiple download methods in sequence
  try {
    // Method 1: Using file-saver library (most reliable)
    console.log("Attempting download using file-saver");
    saveAs(blob, filename);
    
    // Wait a moment to allow the download to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } catch (error) {
    console.warn("File-saver download failed:", error);
  }
  
  try {
    // Method 2: Using URL.createObjectURL
    console.log("Attempting download using URL.createObjectURL");
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    
    // Wait a moment to allow the download to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.warn("URL.createObjectURL download failed:", error);
  }
  
  try {
    // Method 3: Using data URL
    console.log("Attempting download using data URL");
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    document.body.appendChild(link);
    link.click();
    
    // Wait a moment to allow the download to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.warn("Data URL download failed:", error);
  }
  
  // All methods failed
  console.error("All download methods failed");
  return false;
};

/**
 * Ensures the document generation process completes at 100%
 * @param downloadFn Function to handle the document download
 * @param timeoutMs Timeout in milliseconds
 * @returns A promise that resolves to true if the download was successful
 */
export const withDownloadTimeout = async (
  downloadFn: () => Promise<boolean>,
  timeoutMs: number = 10000
): Promise<boolean> => {
  try {
    // Create a timeout promise that rejects after the specified time
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error("Download timeout")), timeoutMs);
    });
    
    // Race the download against the timeout
    return await Promise.race([downloadFn(), timeoutPromise]);
  } catch (error) {
    console.error("Download timed out or failed:", error);
    return false;
  }
};

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @param onRetry Callback function called on each retry
 * @returns A promise that resolves to the result of the function
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // First attempt doesn't count as a retry
      if (attempt > 0) {
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        
        // Add some jitter to prevent all retries happening at the same time
        const jitter = Math.random() * 300;
        const totalDelay = delay + jitter;
        
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${totalDelay.toFixed(0)}ms delay`);
        
        // Call the onRetry callback if provided
        if (onRetry && lastError) {
          onRetry(attempt, lastError);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
      
      // Attempt the function
      return await fn();
    } catch (error) {
      console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }
  
  // This should never happen due to the throw in the loop
  throw new Error('Retry failed: Maximum retries exceeded');
};

/**
 * Generate a document with retry mechanism
 * @param generateFn Function to generate the document
 * @param onProgress Callback function to report progress
 * @returns A promise that resolves to the generated document blob
 */
export const generateDocumentWithRetry = async (
  generateFn: () => Promise<Response>,
  onProgress?: (status: string, attempt: number) => void
): Promise<Blob> => {
  return retryWithBackoff(
    async () => {
      const response = await generateFn();
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate document');
      }
      
      // If we have a download URL, fetch the document
      if (data.downloadUrl) {
        const docxResponse = await fetch(data.downloadUrl);
        
        if (!docxResponse.ok) {
          throw new Error(`Failed to fetch document: ${docxResponse.status}`);
        }
        
        return await docxResponse.blob();
      }
      
      // If we have base64 data, convert it to a blob
      if (data.docxBase64) {
        const binaryString = window.atob(data.docxBase64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        return new Blob([bytes], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
      }
      
      throw new Error('No document data received from server');
    },
    3, // Max 3 retries
    2000, // Start with 2 second delay
    (attempt, error) => {
      // Report progress on retry
      if (onProgress) {
        onProgress(`Retry ${attempt}/3: ${error.message}`, attempt);
      }
    }
  );
}; 