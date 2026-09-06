import { useState, useEffect } from 'react';

// Collapses the repeated debounced-search useEffect pattern (Customers,
// Products, Suppliers) into one line: const search = useDebouncedValue(searchInput);
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}