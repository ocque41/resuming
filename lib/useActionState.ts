import { useState } from 'react';

export function useActionState<T = any, U = FormData>(
  action: (data: U) => Promise<T>,
  initialState: T
) {
  const [state, setState] = useState<T>(initialState);
  const [isPending, setIsPending] = useState(false);

  const formAction = async (data: U) => {
    setIsPending(true);
    try {
      const res = await action(data);
      setState(res);
    } catch (error: any) {
      setState({ ...initialState, error: error.message });
    } finally {
      setIsPending(false);
    }
  };

  return [state, formAction, isPending] as const;
} 