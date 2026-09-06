import { useState, useEffect, useCallback } from 'react';

// Collapses the loading/error/reload boilerplate that was hand-written
// fresh on every list and detail page (Customers, Products, Suppliers,
// CustomerProfile, etc.) into one hook.
//
// `fetcher` must be a function memoized with useCallback by the caller,
// with whatever dependencies (filters, page, id, date...) it actually
// reads. When those dependencies change, the fetcher's identity
// changes, which is what triggers a reload here -- this mirrors the
// exact useCallback+useEffect shape the pages already used by hand, so
// converting a page to use this hook is a close to 1:1 swap.
//
// `fetcher` can return anything -- a flat array, an object like
// { data, pagination }, or a combined object from a Promise.all of
// several endpoints. The hook doesn't assume a shape; the caller reads
// whatever it returned back out of `data`.
export function useApiResource(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.error || 'Could not load data. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => { reload(); }, [reload]);

  return { data, setData, loading, error, reload };
}