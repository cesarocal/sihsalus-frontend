import { useEffect, useState } from 'react';

interface ApiDataState<T> {
  data?: T;
  error: boolean;
  isLoading: boolean;
}

export function useApiData<T>(load: ((attempt: number) => Promise<T>) | null, attempt = 0): ApiDataState<T> {
  const [state, setState] = useState<ApiDataState<T>>({ error: false, isLoading: true });

  useEffect(() => {
    if (!load) return;
    let active = true;
    setState({ error: false, isLoading: true });

    void load(attempt)
      .then((data) => {
        if (active) setState({ data, error: false, isLoading: false });
      })
      .catch(() => {
        if (active) setState({ error: true, isLoading: false });
      });

    return () => {
      active = false;
    };
  }, [load, attempt]);

  return state;
}
