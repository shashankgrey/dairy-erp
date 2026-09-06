import { useState, useRef, useEffect } from 'react';
import api from '../lib/api';

export default function CustomerAutocomplete({ onSelect, selectedLabel = '' }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const { data } = await api.get('/customers', {
          params: {
            search: query.trim(),
            limit: 8,
          },
        });

        // Supports either:
        // { data: [...] }
        // or [...]
        const customers = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : [];

        setSuggestions(customers);
        setOpen(true);
      } catch (err) {
        console.error('Customer search failed:', err);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function handleSelect(customer) {
    onSelect(customer);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
  }

  function handleChange(e) {
    const value = e.target.value;

    setQuery(value);
    onSelect(null);

    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        value={selectedLabel || query}
        onChange={handleChange}
        onFocus={() => {
          if (query.trim() && suggestions.length > 0) {
            setOpen(true);
          }
        }}
        placeholder="Type name, code, or mobile number..."
        className="w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {loading && (
        <div className="absolute right-3 top-3 text-xs text-muted-light dark:text-muted-dark">
          Searching...
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2.5 cursor-pointer hover:bg-brand-50 dark:hover:bg-white/5 border-b border-border-light dark:border-border-dark last:border-0 text-sm"
            >
              <span className="font-mono text-xs text-brand-500 dark:text-brand-400 mr-2">
                {c.customer_code}
              </span>

              <span>{c.full_name}</span>

              {c.mobile_number && (
                <span className="text-muted-light dark:text-muted-dark ml-2">
                  {c.mobile_number}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open &&
        !loading &&
        query.trim() &&
        suggestions.length === 0 && (
          <div className="absolute z-50 mt-1 w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg px-3 py-3 text-sm text-muted-light dark:text-muted-dark">
            No customers found.
          </div>
        )}
    </div>
  );
}