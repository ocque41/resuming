import {
  Check,
  Loader2,
  RefreshCw,
  Info,
  X,
  AlertCircle
} from 'lucide-react';

export const Icons = {
  logo: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  spinner: Loader2,
  check: Check,
  refresh: RefreshCw,
  info: Info,
  error: X,
  warning: AlertCircle
}; 