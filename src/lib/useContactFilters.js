import { useState, useEffect } from 'react';

/**
 * useContactFilters — Contact list filter & search state.
 * Extracted from App.jsx (Fix #3 — god component reduction).
 * Fully self-contained: no external dependencies.
 */
export function useContactFilters() {
  const [searchQuery,    setSearchQuery]    = useState("");
  const [filterBucket,   setFilterBucket]   = useState("all");
  const [filterStage,    setFilterStage]    = useState("all");
  const [filterDisp,     setFilterDisp]     = useState("all");
  const [queueMode,      setQueueMode]      = useState(false);
  const [filterState,    setFilterState]    = useState("all");
  const [filterTimezone, setFilterTimezone] = useState("all");
  const [filterMonth,    setFilterMonth]    = useState("all");
  const [showFilters,    setShowFilters]    = useState(false);
  const [page,           setPage]           = useState(1);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterBucket, filterStage, filterDisp, queueMode, filterState, filterTimezone, filterMonth]);

  return {
    searchQuery,    setSearchQuery,
    filterBucket,   setFilterBucket,
    filterStage,    setFilterStage,
    filterDisp,     setFilterDisp,
    queueMode,      setQueueMode,
    filterState,    setFilterState,
    filterTimezone, setFilterTimezone,
    filterMonth,    setFilterMonth,
    showFilters,    setShowFilters,
    page,           setPage,
  };
}
