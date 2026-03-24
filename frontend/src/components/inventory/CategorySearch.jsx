import { useState, useRef, useEffect } from 'react';

/**
 * Searchable category combobox.
 * - Filters the list as the user types
 * - Selecting an item sets value and closes the dropdown
 * - "Other (custom)" always appears at the bottom; selecting it reveals a free-text input
 * - Clicking outside commits the typed text as a custom value (if it doesn't match a known category)
 *
 * Props:
 *   categories    string[]   — list of known category names
 *   value         string     — currently selected value ('' for none)
 *   onChange      fn(string) — called with the new value
 *   required      bool
 *   disabled      bool
 *   placeholder   string
 *   className     string     — extra classes on the outer <div>
 *   inputClassName string    — classes applied to the <input> elements
 */
export default function CategorySearch({
  categories = [],
  value = '',
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Search categories…',
  className = '',
  inputClassName = '',
}) {
  const isKnown = categories.includes(value);
  const [query, setQuery] = useState(isKnown ? value : '');
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(!!value && !isKnown);
  const [customText, setCustomText] = useState(!isKnown ? value : '');
  const containerRef = useRef(null);

  // Sync when parent changes value externally
  useEffect(() => {
    const known = categories.includes(value);
    if (known) {
      setQuery(value);
      setCustomMode(false);
      setCustomText('');
    } else if (value) {
      setCustomMode(true);
      setCustomText(value);
      setQuery('');
    } else {
      setQuery('');
      setCustomMode(false);
      setCustomText('');
    }
  }, [value, categories]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = categories.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );

  const handleSearchChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    // While typing, clear the committed value so required validation waits
    onChange?.('');
  };

  const handleSelect = (cat) => {
    setQuery(cat);
    setOpen(false);
    setCustomMode(false);
    onChange?.(cat);
  };

  const handleCustomOption = () => {
    setCustomMode(true);
    setCustomText('');
    setQuery('');
    setOpen(false);
    onChange?.('');
  };

  const handleCustomTextChange = (e) => {
    setCustomText(e.target.value);
    onChange?.(e.target.value);
  };

  const handleBackToSearch = () => {
    setCustomMode(false);
    setCustomText('');
    setQuery('');
    onChange?.('');
  };

  const base =
    `w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition duration-150 disabled:bg-gray-50 disabled:text-gray-500 ${inputClassName}`;

  if (customMode) {
    return (
      <div className={className}>
        <input
          type="text"
          value={customText}
          onChange={handleCustomTextChange}
          placeholder="Enter custom category"
          className={base}
          required={required}
          disabled={disabled}
          autoFocus
        />
        <button
          type="button"
          className="mt-1 text-xs text-slate-500 hover:text-slate-700 underline"
          onClick={handleBackToSearch}
          disabled={disabled}
        >
          ← Back to list
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={handleSearchChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={base}
        // Only mark required when there's no committed value
        required={required && !value}
        disabled={disabled}
        autoComplete="off"
        aria-haspopup="listbox"
        aria-expanded={open}
      />

      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {filtered.length === 0 && query && (
            <li className="px-3 py-2 text-sm text-gray-400 select-none">
              No matches
            </li>
          )}
          {filtered.map((cat) => (
            <li
              key={cat}
              role="option"
              aria-selected={cat === value}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${
                cat === value ? 'bg-slate-50 font-medium' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on input so blur doesn't fire first
                handleSelect(cat);
              }}
            >
              {cat}
            </li>
          ))}
          <li
            role="option"
            className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 text-slate-500 italic border-t border-gray-200"
            onMouseDown={(e) => {
              e.preventDefault();
              handleCustomOption();
            }}
          >
            Other (custom)…
          </li>
        </ul>
      )}
    </div>
  );
}
