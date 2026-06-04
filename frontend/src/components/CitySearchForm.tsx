'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { City } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CitySearchForm() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  // Debounced server-side search (scales to a full US-cities dataset).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API}/api/v1/cities/?search=${encodeURIComponent(q)}&page_size=8`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list: City[] = data?.results ?? (Array.isArray(data) ? data : []);
          setSuggestions(list);
          setHighlighted(-1);
          setOpen(list.length > 0);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the keyboard-highlighted suggestion scrolled into view.
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  function selectCity(city: City) {
    setQuery(city.name);
    setOpen(false);
    router.push(`/city/${city.slug}`);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0) {
        selectCity(suggestions[highlighted]);
      } else if (suggestions.length === 1) {
        selectCity(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Search a city..."
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search for a city"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <span className="search-input-icon">
          <Search size={18} />
        </span>
      </div>

      {open && (
        <ul className="city-dropdown" role="listbox" ref={listRef}>
          {suggestions.map((city, i) => (
            <li
              key={city.id}
              role="option"
              aria-selected={i === highlighted}
              className={`city-dropdown-item${i === highlighted ? ' city-dropdown-item--active' : ''}`}
              onMouseDown={() => selectCity(city)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="city-dropdown-name">{city.name}</span>
              <span className="city-dropdown-count">{city.venue_count} venues</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
