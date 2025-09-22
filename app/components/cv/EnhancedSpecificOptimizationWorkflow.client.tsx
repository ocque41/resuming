import React, { memo, useState, useRef, useCallback, useEffect } from 'react';

interface TailoringJobProps {
  cvId: string;
  jobId: string;
  onComplete: (result: any) => void;
  onError: (error: string) => void;
}

const TailoringJob = memo(
  ({ cvId, jobId, onComplete, onError }: TailoringJobProps) => {
    const [status, setStatus] = useState<string>('processing');
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [timeoutOccurred, setTimeoutOccurred] = useState<boolean>(false);
    const [canRetry, setCanRetry] = useState<boolean>(false);
    const [isRetrying, setIsRetrying] = useState<boolean>(false);
    const [continuePolling, setContinuePolling] = useState<boolean>(true);
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);
    const [lastError, setLastError] = useState<string | null>(null);
    const [forceContinue, setForceContinue] = useState<boolean>(false);
    
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const consecutiveErrorsRef = useRef<number>(0);
    const maxRetries = 3;
    
    const clearPollInterval = useCallback(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, []);
    
    const handleRetry = useCallback(async () => {
      try {
        setIsRetrying(true);
        setError(null);
        setStatus('processing');
        setProgress(0);
        setTimeoutOccurred(false);
        setContinuePolling(true);
        startTimeRef.current = Date.now();
        consecutiveErrorsRef.current = 0;
        
        // Calculate backoff delay based on retry count
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        
        // Call the API to restart the job with force continue if needed
        const response = await fetch(`/api/cv/tailor-for-job/process?jobId=${jobId}&cvId=${cvId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            retry: true,
            forceContinue: forceContinue,
            priority: retryCount > 0 ? 'high' : 'normal'
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to retry job processing');
        }
        
        // Start polling again after backoff delay
        setTimeout(() => {
          startPolling();
          setIsRetrying(false);
        }, backoffDelay);
        
        setRetryCount(prev => prev + 1);
      } catch (error) {
        console.error('Error retrying job:', error);
        setError(error instanceof Error ? error.message : 'Failed to retry job');
        setStatus('error');
        setIsRetrying(false);
        setCanRetry(retryCount < maxRetries);
      }
    }, [jobId, cvId, retryCount, forceContinue]);
    
    const startPolling = useCallback(() => {
      clearPollInterval();
      
      // Reset retry state
      setIsRetrying(false);
      
      pollIntervalRef.current = setInterval(async () => {
        try {
          // Update elapsed time
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
          
          // Check job status
          const response = await fetch(`/api/cv/tailor-for-job/status?jobId=${jobId}`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch job status');
          }
          
          const data = await response.json();
          
          // Reset consecutive errors on successful response
          consecutiveErrorsRef.current = 0;
          
          // Always update progress
          if (data.progress !== undefined && data.progress !== null) {
            setProgress(data.progress);
          }
          
          // Handle various status responses
          if (data.status === 'completed' && data.result) {
            setStatus('completed');
            setProgress(100);
            setResult(data.result);
            clearPollInterval();
            onComplete(data.result);
            setContinuePolling(false);
          } else if (data.status === 'error') {
            setStatus('error');
            setError(data.error || 'An unknown error occurred');
            setLastError(data.error || 'An unknown error occurred');
            clearPollInterval();
            onError(data.error || 'Job processing failed');
            setCanRetry(data.canRetry !== false && retryCount < maxRetries);
            setContinuePolling(false);
          } else if (data.status === 'timeout' || elapsedTime > 45) {
            // Handle timeout state
            setTimeoutOccurred(true);
            setEstimatedTimeRemaining(data.estimatedTimeRemaining || null);
            
            // If we've been waiting too long, offer to force continue
            if (elapsedTime > 60 && !forceContinue) {
              setForceContinue(true);
            }
            
            // Keep polling if the backend says to
            if (!data.continuePolling) {
              clearPollInterval();
              setContinuePolling(false);
            }
          } else {
            // Any other status (processing, pending, etc.)
            setStatus(data.status || 'processing');
          }
        } catch (error) {
          console.error('Error checking job status:', error);
          consecutiveErrorsRef.current++;
          
          // Don't immediately fail on network errors, they might be temporary
          // but increment a counter and fail after multiple consecutive errors
          if (consecutiveErrorsRef.current > 5 || elapsedTime > 300) { // 5 minutes max total time
            setStatus('error');
            setError('Connection issue or job processing failed');
            setLastError('Connection issue or job processing failed');
            clearPollInterval();
            onError('Job status checking failed');
            setCanRetry(retryCount < maxRetries);
            setContinuePolling(false);
          }
        }
      }, 3000); // Poll every 3 seconds
    }, [jobId, clearPollInterval, onComplete, onError, elapsedTime, continuePolling, cvId, retryCount, forceContinue]);
    
    useEffect(() => {
      startPolling();
      
      return () => {
        clearPollInterval();
      };
    }, [startPolling, clearPollInterval]);
    
    // Render different content based on status
    const renderContent = () => {
      if (status === 'error') {
        return (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
            <h3 className="text-red-800 font-medium">Job Processing Failed</h3>
            <p className="text-red-700 mt-2">{error || 'An unknown error occurred'}</p>
            {canRetry && (
              <div className="mt-3">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {isRetrying ? 'Retrying...' : 'Retry Processing'}
                </button>
                {retryCount > 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    Retry attempt {retryCount} of {maxRetries}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      }
      
      // For processing state
      const progressClass = progress < 30 ? 'bg-blue-400' : progress < 70 ? 'bg-blue-500' : 'bg-blue-600';
      
      return (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {timeoutOccurred 
                ? `Optimization taking longer than expected (${Math.floor(elapsedTime)}s)` 
                : `Optimizing CV (${Math.floor(elapsedTime)}s)`}
            </span>
            <span className="text-sm font-medium text-gray-700">{progress}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${progressClass} transition-all duration-300 ease-in-out`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {timeoutOccurred && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-amber-800 text-sm">
                This is taking longer than expected, but we're still working on it in the background.
                {estimatedTimeRemaining && ` Estimated time remaining: ~${estimatedTimeRemaining} seconds.`}
              </p>
              <div className="flex mt-2">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="text-sm px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md font-medium transition-colors disabled:opacity-50 mr-2"
                >
                  {isRetrying ? 'Restarting...' : 'Restart Process'}
                </button>
                {!continuePolling && (
                  <button
                    onClick={startPolling}
                    className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md font-medium transition-colors"
                  >
                    Resume Checking Status
                  </button>
                )}
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-500 mt-3">
            {progress < 30
              ? 'Analyzing your CV and job requirements...'
              : progress < 60
              ? 'Tailoring your CV content...'
              : progress < 90
              ? 'Polishing and finalizing changes...'
              : 'Almost done, preparing final document...'}
          </p>
        </div>
      );
    };
    
    return <div className="my-4">{renderContent()}</div>;
  }
);

TailoringJob.displayName = 'TailoringJob';

export default TailoringJob;