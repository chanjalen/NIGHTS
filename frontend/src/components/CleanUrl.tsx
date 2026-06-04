'use client';

import { useEffect } from 'react';

/**
 * Removes the given query params from the address bar after first render,
 * without triggering a navigation or refetch. The server component has
 * already read the param (e.g. `from=profile` to point the Back button at
 * the profile), so stripping it here just keeps shared/bookmarked URLs clean.
 */
export default function CleanUrl({ params }: { params: string[] }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const p of params) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash,
      );
    }
    // Run once on mount; params from the initial render are all we need.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
