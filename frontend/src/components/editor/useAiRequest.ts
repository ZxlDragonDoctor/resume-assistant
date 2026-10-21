import { useCallback, useEffect, useRef, useState } from 'react';
import { aiErrorMessage, createRequestScope } from './aiPanelState';

export function useAiRequest<T>() {
  const scope = useRef(createRequestScope());
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => scope.current.cancel(), []);
  const run = useCallback(async (task: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    const request = scope.current.start();
    setLoading(true);
    setData(null);
    setError('');
    try {
      const result = await task(request.signal);
      if (!request.isCurrent()) return null;
      setData(result);
      return result;
    } catch (failure) {
      if (request.isCurrent()) setError(aiErrorMessage(failure));
      return null;
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, []);
  const cancel = useCallback(() => { scope.current.cancel(); setLoading(false); }, []);
  const clear = useCallback(() => { scope.current.cancel(); setLoading(false); setData(null); setError(''); }, []);
  return { data, loading, error, run, cancel, clear };
}
