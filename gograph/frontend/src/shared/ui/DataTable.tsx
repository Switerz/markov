import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";
import styles from "./DataTable.module.css";

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  enableColumnVisibility?: boolean;
  onRowClick?: (row: TData) => void;
  selectedRowId?: string;
  getRowId?: (row: TData) => string;
  emptyState?: ReactNode;
  pageSize?: number;
};

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  enableColumnVisibility = false,
  onRowClick,
  selectedRowId,
  getRowId,
  emptyState,
  pageSize = 20,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: getRowId ? (row) => getRowId(row as TData) : undefined,
    initialState: { pagination: { pageSize } },
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSizeState = table.getState().pagination.pageSize;
  const start = filteredCount === 0 ? 0 : pageIndex * pageSizeState + 1;
  const end = Math.min((pageIndex + 1) * pageSizeState, filteredCount);

  const showToolbar = !!searchPlaceholder || enableColumnVisibility;

  return (
    <div className={styles.root}>
      {showToolbar && (
        <div className={styles.toolbar}>
          {searchPlaceholder && (
            <label className={styles.searchWrap}>
              <Search size={14} aria-hidden className={styles.searchIcon} />
              <input
                type="search"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className={styles.search}
              />
            </label>
          )}
          <div className={styles.toolbarSpacer} />
          {enableColumnVisibility && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<SlidersHorizontal size={14} />}
                >
                  Colunas
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
                  {table.getAllLeafColumns().map((col) => (
                    <DropdownMenu.CheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onCheckedChange={(v) => col.toggleVisibility(!!v)}
                      className={styles.menuItem}
                    >
                      {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                    </DropdownMenu.CheckboxItem>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      )}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className={styles.th}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  {emptyState ?? <span className={styles.emptyText}>Sem resultados.</span>}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const rowId = row.id;
                const isSelected = selectedRowId !== undefined && selectedRowId === rowId;
                return (
                  <tr
                    key={rowId}
                    data-selected={isSelected ? "true" : undefined}
                    className={cn(styles.tr, onRowClick && styles.clickable)}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={styles.td}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <span className={styles.count}>
          Mostrando {start}–{end} de {filteredCount}
        </span>
        <div className={styles.pager}>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<ChevronLeft size={14} />}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            aria-label="Página anterior"
          />
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<ChevronRight size={14} />}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            aria-label="Próxima página"
          />
        </div>
      </div>
    </div>
  );
}
