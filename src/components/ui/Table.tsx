"use client";

import { type ReactNode, isValidElement, useState, useMemo, useEffect } from "react";
import { cn } from "./utils";
import Checkbox from "./Checkbox";
import Button from "./Button";
import Dropdown from "./Dropdown";
import Select from "./Select";
import Input from "./Input";
import Alert from "./Alert";

export interface Column<T> {
  key?: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: "text" | "select";
  filterOptions?: Array<{ label: string; value: string }>;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => ReactNode;
  accessor?: ((row: T, index: number) => ReactNode) | string;
  mobileVisible?: boolean;
}

export type TableVariant = "default" | "striped" | "bordered" | "flat";
export type TableDensity = "compact" | "comfortable" | "spacious";

export interface TableBulkAction<T> {
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "outline";
  onClick: (selectedRows: T[]) => void;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  onAddClick?: () => void;
  actionLabel?: string;
  variant?: TableVariant;
  density?: TableDensity;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  bulkActions?: TableBulkAction<T>[];
  emptyMessage?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  stickyHeader?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  exportable?: boolean;
  exportFilename?: string;
  showColumnVisibility?: boolean;
  toolbarFilters?: ReactNode;
  pagination?: boolean;
  rowsPerPageOptions?: number[];
  defaultRowsPerPage?: number;
  onRowClick?: (row: T) => void;
  mobileCardView?: boolean;
  renderMobileCard?: (row: T, index: number) => ReactNode;
}

const densityPadding: Record<TableDensity, string> = {
  compact: "px-3 py-2 text-xs",
  comfortable: "px-4 py-3 text-sm",
  spacious: "px-5 py-4 text-sm",
};

function extractSearchableText(obj: unknown, seen = new WeakSet<object>()): string {
  if (obj === null || obj === undefined || typeof obj === "function" || typeof obj === "symbol") return "";
  if (typeof obj !== "object") return String(obj);
  if (seen.has(obj)) return "";
  seen.add(obj);
  // React elements contain development owner/fiber graphs. Search their visible
  // children, never component internals or event handler closures.
  if (isValidElement<{ children?: ReactNode }>(obj)) return extractSearchableText(obj.props.children, seen);
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  return values.map(value => extractSearchableText(value, seen)).join(" ");
}


export default function Table<T extends Record<string, any>>({
  columns,
  data,
  keyField = "id",
  title,
  description,
  action,
  onAddClick,
  actionLabel,
  variant = "default",
  density: initialDensity = "comfortable",
  selectable = false,
  onSelectionChange,
  bulkActions = [],
  emptyMessage = "No entries available at the moment.",
  loading = false,
  error,
  onRetry,
  stickyHeader = false,
  className = "",
  searchable = true,
  searchPlaceholder = "Search results",
  exportable = false,
  exportFilename = "export_data",
  showColumnVisibility = true,
  toolbarFilters,
  pagination = true,
  rowsPerPageOptions = [10, 25, 50, 100],
  defaultRowsPerPage = 10,
  onRowClick,
  mobileCardView = true,
  renderMobileCard,
}: TableProps<T>) {
  // State
  const density = initialDensity;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<unknown>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilterRow, setShowFilterRow] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const [requestedPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  // Preserve valid selections when a refreshed dataset removes records.
  useEffect(() => {
    if (!selected.size) return;
    const validIds = new Set(data.map((row) => row[keyField]));
    const next = new Set([...selected].filter((id) => validIds.has(id)));
    if (next.size !== selected.size) {
      setSelected(next);
      onSelectionChange?.(data.filter((row) => next.has(row[keyField])));
    }
  }, [data, keyField, selected, onSelectionChange]);

  // Filtered columns based on visibility menu
  const visibleColumns = useMemo(() => {
    return columns.filter((col, idx) => {
      const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(idx);
      return !hiddenColumns.has(colKey);
    });
  }, [columns, hiddenColumns]);

  const toggleColumnVisibility = (colKey: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) {
        next.delete(colKey);
      } else {
        next.add(colKey);
      }
      return next;
    });
  };

  const handleSort = (key: string) => {
    setSortDir(sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc");
    setSortKey(key);
  };

  const handleColumnFilterChange = (colKey: string, val: string) => {
    setColumnFilters((prev) => ({ ...prev, [colKey]: val }));
    setCurrentPage(1);
  };

  const searchableRows = useMemo(() => data.map((row) => extractSearchableText(row).toLowerCase()), [data]);

  // Global Search & Column Filter Matching
  const filteredData = useMemo(() => {
    return data.filter((row, rowIndex) => {
      // 1. Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        // Check row's flat values, nested objects, and column accessors
        const deepRowString = searchableRows[rowIndex];
        let matches = deepRowString.includes(q);

        if (!matches) {
          // Also check explicit column accessors
          matches = columns.some((col) => {
            if (typeof col.accessor === "function") {
              const res = col.accessor(row, 0);
              return typeof res === "string" || typeof res === "number"
                ? String(res).toLowerCase().includes(q)
                : false;
            }
            return false;
          });
        }

        if (!matches) return false;
      }

      // 2. Column-Level Filters
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal.trim()) continue;
        const targetVal = String(row[colKey] ?? "").toLowerCase();
        if (!targetVal.includes(filterVal.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [data, searchQuery, columnFilters, columns, searchableRows]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const comp = aVal < bVal ? -1 : 1;
      return sortDir === "asc" ? comp : -comp;
    });
  }, [filteredData, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const currentPage = Math.min(requestedPage, totalPages);
  useEffect(() => { if (requestedPage > totalPages) setCurrentPage(totalPages); }, [requestedPage, totalPages]);
  const displayEmptyMessage = error ? "Results are unavailable. Please try again." : searchQuery.trim() || Object.values(columnFilters).some(Boolean) ? "No results match your search or filters." : emptyMessage;
  const currentData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, pagination]);

  // Dynamic Sliding Pagination Window
  const paginationRange = useMemo(() => {
    const delta = 2; // Number of pages before and after current
    const range: (number | string)[] = [];
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    range.push(1);
    if (left > 2) range.push("ellipsis-left");
    for (let i = left; i <= right; i++) {
      range.push(i);
    }
    if (right < totalPages - 1) range.push("ellipsis-right");
    if (totalPages > 1) range.push(totalPages);

    return range;
  }, [currentPage, totalPages]);

  // Selection Logic
  const toggleAll = () => {
    if (currentData.length > 0 && currentData.every((row) => selected.has(row[keyField]))) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const newSet = new Set(currentData.map((d) => d[keyField]));
      setSelected(newSet);
      onSelectionChange?.(currentData);
    }
  };

  const toggleRow = (row: T) => {
    const val = row[keyField];
    const newSet = new Set(selected);
    if (newSet.has(val)) {
      newSet.delete(val);
    } else {
      newSet.add(val);
    }
    setSelected(newSet);
    onSelectionChange?.(data.filter((d) => newSet.has(d[keyField])));
  };

  const selectedRowsList = useMemo(() => {
    return data.filter((d) => selected.has(d[keyField]));
  }, [data, selected, keyField]);

  // Clean CSV Export Helper
  const extractCellCSV = (col: Column<T>, row: T, idx: number): string => {
    if (typeof col.accessor === "function") {
      const res = col.accessor(row, idx);
      return typeof res === "string" || typeof res === "number" ? String(res) : "";
    }
    const key = col.key || (typeof col.accessor === "string" ? col.accessor : "");
    if (!key) return "";
    const val = (row as any)[key];
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      return val.name || val.title || val.label || val.id || JSON.stringify(val);
    }
    return String(val);
  };

  // CSV Export
  const exportToCSV = () => {
    if (!data || data.length === 0) return;
    const headers = visibleColumns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
    const rows = sortedData.map((row, idx) =>
      visibleColumns
        .map((col) => {
          const str = extractCellCSV(col, row, idx).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${exportFilename}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasFilterableColumns = columns.some((c) => c.filterable);
  const activeFiltersCount = Object.values(columnFilters).filter(Boolean).length;
  const hasToolbar = Boolean(title || description || action || searchable || hasFilterableColumns || showColumnVisibility || exportable || onAddClick || toolbarFilters);
  const hasMobileControls = selectable || columns.some((column) => column.sortable) || hasFilterableColumns || Boolean(sortKey);

  return (
    <div aria-busy={loading} className={cn("w-full flex flex-col relative", className)}>
      {/* UNIFIED PREMIUM CARD WRAPPER */}
      <div className={cn(
        "w-full rounded-container border border-border bg-surface overflow-hidden flex flex-col",
        variant === "bordered" && "border border-border",
        variant === "flat" && "border-none shadow-none bg-transparent"
      )}>

        {/* 1. TOP TOOLBAR BAR (TITLE, ACTION, PILL SEARCH & FILTER CONTROLS) */}
        {hasToolbar && <div className="p-3.5 sm:p-4 bg-surface border-b border-border/80 flex flex-col gap-2.5 sm:gap-3">
          {/* Title & Primary Action Row */}
          {(title || description || action) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-border/60">
              <div>
                {title && <h3 className="text-base sm:text-lg font-semibold text-text tracking-tight">{title}</h3>}
                {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
              </div>
              {action && <div className="shrink-0 flex items-center">{action}</div>}
            </div>
          )}

          {/* Top Row: Pill Search Bar + Quick Icon Controls */}
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2.5 w-full">
            {/* Pill Search Input */}
            {searchable && (
              <Input
                type="search"
                aria-label="Search table"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                onClear={() => { setSearchQuery(""); setCurrentPage(1); }}
                placeholder={searchPlaceholder}
                size="sm"
                containerClassName="basis-full md:basis-0 flex-1 min-w-0"
              />
            )}

            {/* Quick Action Icons */}
            <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
              {hasFilterableColumns && (
                <button
                  type="button"
                  onClick={() => setShowFilterRow(!showFilterRow)}
                  className={cn(
                    "touch-target p-2 rounded-xl border border-border/80 bg-surface text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors relative cursor-pointer shadow-2xs",
                    (showFilterRow || activeFiltersCount > 0) && "border-primary-500 text-accent bg-primary-500/10"
                  )}
                  title={showFilterRow ? "Hide column filters" : "Show column filters"}
                  aria-label={showFilterRow ? "Hide column filters" : "Show column filters"}
                  aria-expanded={showFilterRow}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
              )}

              {showColumnVisibility && (
                <Dropdown
                  align="right"
                  trigger={
                    <button
                      type="button"
                      className="touch-target p-2 rounded-xl border border-border/80 bg-surface text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shadow-2xs"
                      title="Column Visibility"
                      aria-label="Column visibility"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  }
                  items={columns.map((col, idx) => {
                    const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(idx);
                    const isVisible = !hiddenColumns.has(colKey);
                    return {
                      label: `${isVisible ? "✓ " : "   "}${col.header}`,
                      active: isVisible,
                      onClick: () => toggleColumnVisibility(colKey),
                    };
                  })}
                />
              )}

              {exportable && (
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="touch-target p-2 rounded-xl border border-border/80 bg-surface text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shadow-2xs"
                  title="Export to CSV"
                  aria-label="Export table data to CSV"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}

              {/* Primary Plus (+) Action Button on Most Right */}
              {onAddClick && (
                <button
                  type="button"
                  onClick={onAddClick}
                  className="touch-target p-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-brand-mist font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
                  title={actionLabel || "Add New Entry"}
                  aria-label={actionLabel || "Add new entry"}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Second Row: Toolbar Filters (Fluid Responsive Flex on Mobile & Desktop) */}
          {toolbarFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 w-full">
              {toolbarFilters}
            </div>
          )}
        </div>}

        {/* Subtle Non-Blocking Loading Shimmer Line */}
        <div className="h-0.5 w-full overflow-hidden shrink-0">
          {loading && currentData.length > 0 && <div className="h-full bg-primary-500 animate-pulse" role="progressbar" aria-label="Loading table data" />}
        </div>


        {error && <Alert variant="error" title="Unable to load results" className="m-3" action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry} loading={loading}>Try again</Button> : undefined}>{error}</Alert>}
        {mobileCardView && hasMobileControls && (
          <div className="md:hidden p-3 border-b border-border/60 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectable && <Checkbox label="Select page" checked={currentData.length > 0 && currentData.every((row) => selected.has(row[keyField]))} onChange={toggleAll} disabled={!currentData.length} />}
              {columns.some((column) => column.sortable) && <div className="flex-1 min-w-0"><Select aria-label="Sort table" size="sm" value={sortKey || ""} placeholder="Sort results" options={columns.filter((column) => column.sortable).map((column) => ({ value: column.key || (typeof column.accessor === "string" ? column.accessor : column.header), label: column.header }))} onChange={(event) => { setSortKey(event.target.value); setSortDir("asc"); }} /></div>}
              {sortKey && <Button variant="outline" size="sm" aria-label="Reverse sort order" onClick={() => setSortDir((direction) => direction === "asc" ? "desc" : "asc")}>{sortDir === "asc" ? "Ascending" : "Descending"}</Button>}
            </div>
            {showFilterRow && <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-3">
              {visibleColumns.filter((column) => column.filterable).map((column, index) => {
                const key = column.key || (typeof column.accessor === "string" ? column.accessor : column.header) || String(index);
                return column.filterType === "select" && column.filterOptions ? <Select key={key} label={column.header} size="sm" value={columnFilters[key] || ""} placeholder="All" options={column.filterOptions} onChange={(event) => handleColumnFilterChange(key, event.target.value)} /> : <Input key={key} label={column.header} size="sm" value={columnFilters[key] || ""} onChange={(event) => handleColumnFilterChange(key, event.target.value)} placeholder={`Filter ${column.header}`} />;
              })}
            </div>}
          </div>
        )}
        {(searchQuery || activeFiltersCount > 0) && <div className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => { setSearchQuery(""); setColumnFilters({}); setCurrentPage(1); }}>Clear search and filters</Button></div>}

        {/* 2. TABLE GRID AREA — Desktop table, Mobile card view */}
        {mobileCardView && (
          <div className={cn("md:hidden p-3 space-y-2.5 transition-opacity duration-200", loading && currentData.length > 0 && "opacity-80")}>
            {loading && currentData.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-border/60 bg-surface-alt/30 space-y-2.5">
                  <div className="h-4 w-3/4 rounded-lg skeleton-shimmer" />
                  <div className="h-3 w-1/2 rounded-lg skeleton-shimmer" />
                  <div className="h-3 w-2/3 rounded-lg skeleton-shimmer" />
                </div>
              ))
            ) : currentData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
                <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center text-text-muted border border-border/60 mb-2">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                </div>
                <span className="font-semibold text-text text-sm">{displayEmptyMessage}</span>
              </div>
            ) : (
              currentData.map((row, i) => {
                if (renderMobileCard) {
                  return (
                    <div key={String(row[keyField] ?? i)} className="space-y-2 min-w-0">
                      {selectable && <Checkbox aria-label={`Select row ${row[keyField] ?? i}`} checked={selected.has(row[keyField])} onChange={() => toggleRow(row)} />}
                      {renderMobileCard(row, i)}
                    </div>
                  );
                }
                const val = row[keyField];
                const mobileColumns = visibleColumns.filter((col) => col.mobileVisible !== false || /action/i.test(col.key || col.header));
                const detailColumns = visibleColumns.filter((col) => !mobileColumns.includes(col));
                return (
                  <div
                    key={String(val ?? i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "p-3.5 rounded-xl border border-border/60 bg-surface space-y-2 transition-all duration-150",
                      onRowClick && "cursor-pointer hover:border-border-focus hover:bg-surface-hover"
                    )}
                  >
                    {selectable && <div onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select row ${val ?? i}`} checked={selected.has(val)} onChange={() => toggleRow(row)} /></div>}
                    {mobileColumns.map((col, colIdx) => {
                      const cellContent = col.render
                        ? col.render(row, i)
                        : typeof col.accessor === "function"
                        ? col.accessor(row, i)
                        : typeof col.accessor === "string"
                        ? (row[col.accessor] ?? "—")
                        : col.key
                        ? (row[col.key] ?? "—")
                        : "—";
                      const isActionCol = (col.key || col.header || "").toLowerCase().includes("action");
                      if (isActionCol) {
                        return (
                          <div key={colIdx} className="flex flex-wrap items-center justify-end gap-2 pt-2 mt-1 border-t border-border/50 w-full [&>button]:min-h-[44px] [&>button]:text-xs [&>a]:min-h-[44px] [&>div]:w-full sm:[&>div]:w-auto">
                            {cellContent}
                          </div>
                        );
                      }
                      return (
                        <div key={colIdx} className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-text-secondary shrink-0">{col.header}</span>
                          <span className="text-sm font-medium text-text text-right min-w-0 break-words">{cellContent}</span>
                        </div>
                      );
                    })}
                    {detailColumns.length > 0 && <details className="border-t border-border/50 pt-2">
                      <summary className="min-h-11 flex items-center text-sm font-medium text-accent cursor-pointer">More details</summary>
                      <dl className="space-y-2 pb-2">{detailColumns.map((column, index) => <div key={column.key || index} className="flex flex-wrap justify-between gap-2"><dt className="text-xs text-text-secondary">{column.header}</dt><dd className="text-sm text-text break-words min-w-0">{column.render ? column.render(row, i) : typeof column.accessor === "function" ? column.accessor(row, i) : row[typeof column.accessor === "string" ? column.accessor : column.key || ""] ?? "?"}</dd></div>)}</dl>
                    </details>}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div tabIndex={0} role="region" aria-label="Table results" className={cn("w-full overflow-x-auto min-h-[220px] touch-scroll scroll-smooth", mobileCardView && "hidden md:block")}>
          <table className="w-full text-sm border-collapse text-left min-w-[650px] sm:min-w-full">
            <thead>
              <tr className={cn(
                "border-b border-border/80 bg-surface-alt/70 text-text-secondary text-xs font-semibold",
                stickyHeader && "sticky top-0 z-10"
              )}>
                {selectable && (
                  <th scope="col" className={cn("w-10 px-3 py-3 align-middle text-center", variant === "bordered" && "border-r border-border/60")}>
                    <Checkbox
                      checked={currentData.length > 0 && currentData.every((row) => selected.has(row[keyField]))}
                      aria-label="Select all rows on this page"
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {visibleColumns.map((col, idx) => {
                  const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(idx);
                  const isActionCol = colKey === "actions" || colKey === "action" || col.header.toLowerCase() === "actions" || col.header.toLowerCase() === "action";
                  const effectiveAlign = col.align || (isActionCol ? "right" : "left");
                  const alignClass = effectiveAlign === "center" ? "text-center" : effectiveAlign === "right" ? "text-right" : "text-left";
                  const isLast = idx === visibleColumns.length - 1;

                  return (
                    <th
                      key={colKey}
                      scope="col"
                      aria-sort={col.sortable && sortKey === colKey ? sortDir === "asc" ? "ascending" : "descending" : undefined}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        "px-4 py-3 text-text-secondary select-none font-semibold text-xs whitespace-nowrap",
                        variant === "bordered" && !isLast && "border-r border-border/60",
                        alignClass
                      )}
                    >
                      <div className={cn("flex items-center gap-1.5", (effectiveAlign === "right") && "justify-end", (effectiveAlign === "center") && "justify-center")}>
                        <span>{col.header}</span>
                        {col.sortable && (
                          <button
                            type="button"
                            onClick={() => handleSort(colKey)}
                            className="p-0.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center"
                            aria-label={`Sort by ${col.header}`}
                          >
                            <span className="text-[10px]">
                              {sortKey === colKey ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>

              {/* Column Filter Row */}
              {showFilterRow && hasFilterableColumns && (
                <tr className="border-b border-border bg-surface">
                  {selectable && <th className={cn("px-3 py-1.5", variant === "bordered" && "border-r border-border/40")} />}
                  {visibleColumns.map((col, idx) => {
                    const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(idx);
                    const isLast = idx === visibleColumns.length - 1;

                    if (!col.filterable) {
                      return <th key={`filter-${colKey}`} className={cn("px-2.5 py-1.5", variant === "bordered" && !isLast && "border-r border-border/40")} />;
                    }

                    return (
                      <th key={`filter-${colKey}`} className={cn("px-2.5 py-1.5 font-normal", variant === "bordered" && !isLast && "border-r border-border/40")}>
                        <input
                          type="text"
                          placeholder={`Filter ${col.header}...`}
                          value={columnFilters[colKey] || ""}
                          onChange={(e) => handleColumnFilterChange(colKey, e.target.value)}
                          aria-label={`Filter ${col.header}`}
                          className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary-500 font-normal"
                        />
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>

            <tbody
              className={cn(
                "divide-y divide-border/60 transition-opacity duration-200",
                loading && currentData.length > 0 && "opacity-80",
                variant === "striped" && "[&>tr:nth-child(even)]:bg-surface-alt/30"
              )}
            >
              {loading && currentData.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {selectable && (
                      <td className={cn("px-3 py-3 align-middle text-center", variant === "bordered" && "border-r border-border/40")}>
                        <div className="h-4 w-4 mx-auto rounded-md skeleton-shimmer" />
                      </td>
                    )}
                    {visibleColumns.map((col, idx) => {
                      const isLast = idx === visibleColumns.length - 1;
                      const widths = ["75%", "55%", "85%", "65%", "45%", "60%"];
                      const width = widths[(i + idx) % widths.length];
                      return (
                        <td key={col.key || String(idx)} className={cn(densityPadding[density], variant === "bordered" && !isLast && "border-r border-border/30")}>
                          <div className="h-4 rounded-lg skeleton-shimmer" style={{ width }} />
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center text-text-muted border border-border/60">
                        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      </div>
                      <span className="font-semibold text-text text-sm">{displayEmptyMessage}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                currentData.map((row, i) => {
                  const val = row[keyField];
                  const isSelected = selected.has(val);
                  return (
                    <tr
                      key={String(val ?? i)}
                      tabIndex={onRowClick ? 0 : undefined}
                      role={onRowClick ? "button" : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      } : undefined}
                      className={cn(
                        "transform-gpu transition-all duration-150 ease-smooth border-b border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
                        onRowClick && "cursor-pointer",
                        isSelected ? "bg-primary-500/10 text-accent font-medium" : "hover:bg-surface-hover/60"
                      )}
                    >
                      {selectable && (
                        <td className={cn("px-3 py-3 align-middle text-center", variant === "bordered" && "border-r border-border/40")}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleRow(row)}
                            aria-label={`Select row ${val ?? i}`}
                          />
                        </td>
                      )}
                      {visibleColumns.map((col, colIdx) => {
                        const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(colIdx);
                        const isActionCol = colKey === "actions" || colKey === "action" || col.header.toLowerCase() === "actions" || col.header.toLowerCase() === "action";
                        const effectiveAlign = col.align || (isActionCol ? "right" : "left");
                        const alignClass = effectiveAlign === "center" ? "text-center" : effectiveAlign === "right" ? "text-right" : "text-left";
                        const isLast = colIdx === visibleColumns.length - 1;
                        const cellContent = col.render
                          ? col.render(row, i)
                          : typeof col.accessor === "function"
                          ? col.accessor(row, i)
                          : typeof col.accessor === "string"
                          ? (row[col.accessor] ?? "—")
                          : col.key
                          ? (row[col.key] ?? "—")
                          : "—";

                        return (
                          <td
                            key={colKey}
                            className={cn(densityPadding[density], alignClass, variant === "bordered" && !isLast && "border-r border-border/30")}
                          >
                            <div className={cn("min-w-0 wrap-anywhere", effectiveAlign === "center" && "flex justify-center items-center", effectiveAlign === "right" && "flex justify-end items-center")}>
                              {cellContent}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 3. FOOTER PAGINATION BAR (ALIGNED & RESPONSIVE) */}
        {pagination && (currentData.length > 0 || !loading) && (
          <div className="px-4 py-3 border-t border-border/80 bg-surface flex flex-col xl:flex-row items-center justify-between gap-3 text-xs text-text-muted">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4 font-medium">
              <span className="shrink-0">
                Showing {sortedData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length}
              </span>

              <div className="flex items-center gap-1.5 font-medium shrink-0">
                <span className="text-[11px]">Rows:</span>
                <div className="w-18 shrink-0">
                  <Select
                    size="sm"
                    aria-label="Rows per page"
                    fullWidth={false}
                    value={rowsPerPage.toString()}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    options={rowsPerPageOptions.map((opt) => ({ value: opt.toString(), label: opt.toString() }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 min-w-[34px] px-2.5 rounded-lg border border-border/80 bg-surface text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer flex items-center justify-center font-bold min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-[34px]"
                  aria-label="Previous page"
                >
                  ‹
                </button>

                {/* Compact mobile page text */}
                <span className="text-xs font-semibold text-text md:hidden px-2">
                  Page {currentPage} of {totalPages}
                </span>

                {/* Desktop Numeric page buttons */}
                <div className="hidden md:flex items-center gap-1">
                  {paginationRange.map((item, idx) => {
                    if (typeof item === "string") {
                      return (
                        <span key={`${item}-${idx}`} className="h-7 w-6 flex items-center justify-center text-xs text-text-muted select-none">
                          …
                        </span>
                      );
                    }
                    const pNum = item;
                    const isActive = currentPage === pNum;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setCurrentPage(pNum)}
                        className={cn(
                          "h-7 min-w-[28px] px-1.5 rounded-lg flex items-center justify-center font-bold text-xs transition-all cursor-pointer shadow-2xs",
                          isActive ? "bg-primary-600 text-brand-mist shadow-xs border border-primary-500" : "border border-border/80 bg-surface text-text-muted hover:text-text hover:bg-surface-hover"
                        )}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 min-w-[34px] px-2.5 rounded-lg border border-border/80 bg-surface text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-2xs cursor-pointer flex items-center justify-center font-bold min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-[34px]"
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>

              {selectable && (
                <div className="px-3 py-1 rounded-xl border border-border/80 bg-surface text-xs font-semibold text-text-secondary shadow-2xs">
                  {selected.size} Selected
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Actions Bar — Elevated on mobile to clear MobileBottomNav */}
      {selectable && selected.size > 0 && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface border border-primary-500/40 text-text px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-xl shadow-text-muted/10  ring-1 ring-black/5 dark:ring-white/10  flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-1.5rem)] animate-fade-up overflow-x-auto no-scrollbar pb-safe">
          <span className="text-xs font-bold text-accent">
            {selected.size} item{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            {bulkActions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || "secondary"}
                size="sm"
                onClick={() => {
                  action.onClick(selectedRowsList);
                  setSelected(new Set());
                  onSelectionChange?.([]);
                }}
                className="whitespace-nowrap text-xs gap-1.5"
              >
                {action.icon}
                <span>{action.label}</span>
              </Button>
            ))}
            <button
              type="button"
              onClick={() => { setSelected(new Set()); onSelectionChange?.([]); }}
              className="text-xs text-text-muted hover:text-text ml-2 underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
