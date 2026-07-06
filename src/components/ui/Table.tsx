"use client";

import { type ReactNode, useState, useMemo } from "react";
import { cn } from "./utils";
import SearchInput from "./SearchInput";
import Checkbox from "./Checkbox";
import Pagination from "./Pagination";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T, index: number) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  emptyMessage?: string;
  loading?: boolean;
  stickyHeader?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pagination?: boolean;
  rowsPerPageOptions?: number[];
  defaultRowsPerPage?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Table<T extends Record<string, any>>({
  columns, data, keyField = "id", selectable = false, onSelectionChange,
  emptyMessage = "No data found", loading = false, stickyHeader = false, className = "",
  searchable = true, searchPlaceholder = "Search...", pagination = true,
  rowsPerPageOptions = [5, 10, 25, 50], defaultRowsPerPage = 10,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<unknown>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  const handleSort = (key: string) => {
    setSortDir(sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc");
    setSortKey(key);
  };

  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(row => {
      return Object.values(row).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery, searchable]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null || bv == null) return 0;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const currentData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, pagination]);

  const toggleAll = () => {
    if (selected.size === currentData.length && currentData.length > 0) { 
      setSelected(new Set()); 
      onSelectionChange?.([]); 
    } else { 
      const next = new Set(currentData.map((r) => r[keyField]));
      setSelected(next); 
      onSelectionChange?.(data.filter((r) => next.has(r[keyField]))); 
    }
  };

  const toggleRow = (row: T) => {
    const key = row[keyField];
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
    onSelectionChange?.(data.filter((r) => next.has(r[keyField])));
  };

  return (
    <div className={cn("w-full flex flex-col gap-4", className)}>
      {/* Toolbar */}
      {searchable && (
        <div className="flex items-center justify-between gap-4">
          <div className="w-full max-w-sm">
            <SearchInput 
              placeholder={searchPlaceholder} 
              value={searchQuery}
              onChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
            />
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn("border-b border-border bg-surface-alt", stickyHeader && "sticky top-0 z-10")}>
              {selectable && (
                <th className="w-10 px-4 py-3 align-middle">
                  <Checkbox 
                    checked={selected.size === currentData.length && currentData.length > 0} 
                    onChange={toggleAll} 
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn("px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider", col.sortable && "cursor-pointer select-none hover:text-text transition-colors duration-150")}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <span className="flex flex-col opacity-50">
                        <svg className={cn("h-2 w-2", sortKey === col.key && sortDir === "asc" && "text-primary-600 opacity-100")} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 10H4z"/></svg>
                        <svg className={cn("h-2 w-2", sortKey === col.key && sortDir === "desc" && "text-primary-600 opacity-100")} viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-10h16z"/></svg>
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-surface-alt animate-shimmer" /></td>}
                  {columns.map((col) => <td key={col.key} className="px-4 py-3"><div className="h-4 w-3/4 rounded bg-surface-alt animate-shimmer" /></td>)}
                </tr>
              ))
            ) : currentData.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center text-text-muted">{emptyMessage}</td></tr>
            ) : (
              currentData.map((row, i) => {
                const isSelected = selected.has(row[keyField]);
                return (
                  <tr
                    key={String(row[keyField] ?? i)}
                    className={cn("transition-colors duration-100", isSelected ? "bg-primary-50/30 dark:bg-primary-950/10" : "hover:bg-surface-hover")}
                  >
                    {selectable && (
                      <td className="px-4 py-3 align-middle">
                        <Checkbox 
                          checked={isSelected} 
                          onChange={() => toggleRow(row)} 
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-text align-middle">{col.render ? col.render(row, i) : (row[col.key] ?? "—")}</td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        
        {/* Pagination Footer */}
        {pagination && !loading && sortedData.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 gap-3 border-t border-border bg-surface-alt">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span>Show</span>
              <div className="relative flex items-center">
                <select 
                  className="appearance-none bg-surface border border-border rounded-lg py-1.5 pl-3.5 pr-8 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 cursor-pointer transition-all"
                  value={rowsPerPage} 
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  {rowsPerPageOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <span>entries</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-text-muted">
              <span>Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length}</span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

