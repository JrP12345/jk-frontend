"use client";

import { type ReactNode, useState, useMemo } from "react";
import { cn } from "./utils";
import Checkbox from "./Checkbox";
import Button from "./Button";
import Dropdown from "./Dropdown";
import Select from "./Select";

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
}

const densityPadding: Record<TableDensity, string> = {
  compact: "px-3 py-2 text-xs",
  comfortable: "px-4 py-3 text-sm",
  spacious: "px-5 py-4 text-sm",
};

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
  stickyHeader = false,
  className = "",
  searchable = true,
  searchPlaceholder = "Type to filter results",
  exportable = false,
  exportFilename = "export_data",
  showColumnVisibility = true,
  toolbarFilters,
  pagination = true,
  rowsPerPageOptions = [10, 25, 50, 100],
  defaultRowsPerPage = 10,
}: TableProps<T>) {
  // State
  const [density, setDensity] = useState<TableDensity>(initialDensity);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<unknown>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilterRow, setShowFilterRow] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

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

  // Global Search & Column Filter Matching
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // 1. Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesGlobal = Object.values(row).some((val) =>
          String(val ?? "").toLowerCase().includes(q)
        );
        if (!matchesGlobal) return false;
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
  }, [data, searchQuery, columnFilters]);

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
  const currentData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, pagination]);

  // Selection Logic
  const toggleAll = () => {
    if (selected.size === currentData.length && currentData.length > 0) {
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

  // CSV Export
  const exportToCSV = () => {
    if (!data || data.length === 0) return;
    const headers = visibleColumns.map((c) => c.header).join(",");
    const rows = sortedData.map((row) =>
      visibleColumns
        .map((col) => {
          const key = col.key || (typeof col.accessor === "string" ? col.accessor : "");
          const val = key ? row[key] : "";
          const str = String(val ?? "").replace(/"/g, '""');
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

  return (
    <div className={cn("w-full flex flex-col relative", className)}>
      {/* UNIFIED PREMIUM CARD WRAPPER */}
      <div className={cn(
        "w-full rounded-2xl border border-border/80 bg-surface shadow-sm overflow-hidden flex flex-col transition-all",
        variant === "bordered" && "border-2 border-border",
        variant === "flat" && "border-none shadow-none bg-transparent"
      )}>

        {/* 1. TOP TOOLBAR BAR (TITLE, ACTION, PILL SEARCH & FILTER CONTROLS) */}
        <div className="p-3 sm:p-4 bg-surface-alt/30 border-b border-border/70 flex flex-col gap-2.5 sm:gap-3">
          {/* Title & Primary Action Row */}
          {(title || description || action) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-border/40">
              <div>
                {title && <h3 className="text-base sm:text-lg font-bold text-text">{title}</h3>}
                {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
              </div>
              {action && <div className="shrink-0 flex items-center">{action}</div>}
            </div>
          )}

          {/* Top Row: Pill Search Bar + Quick Icon Controls */}
          <div className="flex items-center gap-2.5 w-full">
            {/* Pill Search Input */}
            {searchable && (
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder={searchPlaceholder}
                  className="w-full bg-surface-alt/70 border border-border/80 rounded-full pl-10 pr-9 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Quick Action Icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {hasFilterableColumns && (
                <button
                  type="button"
                  onClick={() => setShowFilterRow(!showFilterRow)}
                  className={cn(
                    "p-2 rounded-lg border border-border text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors relative",
                    (showFilterRow || activeFiltersCount > 0) && "border-primary-500 text-primary-500 bg-primary-500/10"
                  )}
                  title="Toggle Header Filters"
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
                      className="p-2 rounded-lg border border-border text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                      title="Column Visibility"
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
                      onClick: () => toggleColumnVisibility(colKey),
                    };
                  })}
                />
              )}

              {exportable && (
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="p-2 rounded-lg border border-border text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                  title="Export to CSV"
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
                  className="p-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
                  title={actionLabel || "Add New Entry"}
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
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 w-full">
              {toolbarFilters}
            </div>
          )}
        </div>

        {/* 2. TABLE GRID AREA */}
        <div className="w-full overflow-x-auto min-h-[220px]">
          <table className="w-full text-sm border-collapse text-left min-w-[650px] sm:min-w-full">
            <thead>
              <tr className={cn(
                "border-b border-border bg-surface-alt/70 text-text font-bold text-xs uppercase tracking-wider",
                stickyHeader && "sticky top-0 z-10"
              )}>
                {selectable && (
                  <th className="w-10 px-3 py-3 align-middle text-center border-r border-border/40">
                    <Checkbox
                      checked={selected.size === currentData.length && currentData.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {visibleColumns.map((col, idx) => {
                  const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(idx);
                  const isActionCol = colKey === "actions" || colKey === "action" || col.header.toLowerCase() === "actions" || col.header.toLowerCase() === "action";
                  const effectiveAlign = isActionCol ? "center" : col.align;
                  const alignClass = effectiveAlign === "center" ? "text-center" : effectiveAlign === "right" ? "text-right" : "text-left";
                  const isLast = idx === visibleColumns.length - 1;

                  return (
                    <th
                      key={colKey}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        "px-4 py-3 text-text-secondary select-none font-bold text-xs tracking-wider whitespace-nowrap",
                        !isLast && "border-r border-border/40",
                        alignClass
                      )}
                    >
                      <div className={cn("flex items-center gap-1.5", (effectiveAlign === "right") && "justify-end", (effectiveAlign === "center") && "justify-center")}>
                        <span>{col.header}</span>
                        {col.sortable && (
                          <button
                            type="button"
                            onClick={() => handleSort(colKey)}
                            className="p-0.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text cursor-pointer"
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
                <tr className="border-b border-border bg-surface-alt/40">
                  {selectable && <th className="px-3 py-1.5 border-r border-border/40" />}
                  {visibleColumns.map((col, idx) => {
                    const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(idx);
                    const isLast = idx === visibleColumns.length - 1;

                    if (!col.filterable) {
                      return <th key={`filter-${colKey}`} className={cn("px-2.5 py-1.5", !isLast && "border-r border-border/40")} />;
                    }

                    return (
                      <th key={`filter-${colKey}`} className={cn("px-2.5 py-1.5 font-normal", !isLast && "border-r border-border/40")}>
                        <input
                          type="text"
                          placeholder={`Filter ${col.header}...`}
                          value={columnFilters[colKey] || ""}
                          onChange={(e) => handleColumnFilterChange(colKey, e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary-500 font-normal"
                        />
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>

            <tbody className={cn("divide-y divide-border/50", variant === "striped" && "[&>tr:nth-child(even)]:bg-surface-alt/25")}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {selectable && <td className="px-3 py-3 align-middle text-center"><div className="h-4 w-4 rounded-md skeleton-shimmer" /></td>}
                    {visibleColumns.map((col, idx) => (
                      <td key={col.key || String(idx)} className={densityPadding[density]}>
                        <div className="h-4 w-4/5 rounded-lg skeleton-shimmer" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center text-text-muted border border-border/60">
                        <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      </div>
                      <span className="font-semibold text-text text-sm">{emptyMessage}</span>
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
                      className={cn(
                        "transition-colors duration-150 border-b border-border/40",
                        isSelected ? "bg-primary-500/10 text-primary-400 font-medium" : "hover:bg-surface-hover/50"
                      )}
                    >
                      {selectable && (
                        <td className="px-3 py-3 align-middle text-center">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleRow(row)}
                          />
                        </td>
                      )}
                      {visibleColumns.map((col, colIdx) => {
                        const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : col.header) || String(colIdx);
                        const isActionCol = colKey === "actions" || colKey === "action" || col.header.toLowerCase() === "actions" || col.header.toLowerCase() === "action";
                        const effectiveAlign = isActionCol ? "center" : col.align;
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
                            className={cn(densityPadding[density], alignClass, !isLast && "border-r border-border/30")}
                          >
                            <div className={cn(effectiveAlign === "center" && "flex justify-center items-center", effectiveAlign === "right" && "flex justify-end items-center")}>
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
        {pagination && !loading && (
          <div className="px-4 py-3 border-t border-border/70 bg-surface-alt/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4 font-medium">
              <span className="shrink-0">
                Showing {sortedData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length}
              </span>

              <div className="flex items-center gap-1.5 font-medium shrink-0">
                <span className="text-[11px]">Rows:</span>
                <div className="w-18 shrink-0">
                  <Select
                    size="sm"
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

            <div className="flex items-center justify-center sm:justify-end gap-3 w-full sm:w-auto shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-md border border-border/80 bg-surface text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹
                </button>

                {Array.from({ length: totalPages }).slice(0, 5).map((_, idx) => {
                  const pNum = idx + 1;
                  const isActive = currentPage === pNum;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs transition-all cursor-pointer",
                        isActive ? "bg-primary-600 text-white shadow-xs" : "text-text-muted hover:text-text hover:bg-surface-hover"
                      )}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded-md border border-border/80 bg-surface text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ›
                </button>
              </div>

              {selectable && (
                <div className="px-3 py-1 rounded-lg border border-border/80 bg-surface text-xs font-semibold text-text-secondary">
                  {selected.size} Selected
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectable && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface border border-primary-500/40 text-text px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-300">
          <span className="text-xs font-bold text-primary-500">
            {selected.size} item{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            {bulkActions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || "secondary"}
                size="sm"
                onClick={() => action.onClick(selectedRowsList)}
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
