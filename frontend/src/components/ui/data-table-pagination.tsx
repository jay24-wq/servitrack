import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from './button';

type PageItem = number | 'gap-start' | 'gap-end';

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, 'gap-end', totalPages];
  if (page >= totalPages - 2) return [1, 'gap-start', totalPages - 2, totalPages - 1, totalPages];
  return [1, 'gap-start', page - 1, page, page + 1, 'gap-end', totalPages];
}

export default function DataTablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  visibleItems,
  itemLabel,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  visibleItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  const start = visibleItems ? (page - 1) * pageSize + 1 : 0;
  const end = visibleItems ? start + visibleItems - 1 : 0;

  return (
    <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
      <span className="text-xs leading-4 text-zinc-600">
        Menampilkan <span className="font-medium text-zinc-900">{start}{visibleItems ? ` - ${end}` : ''}</span> dari{' '}
        <span className="font-medium text-zinc-900">{totalItems}</span> {itemLabel}
      </span>
      <nav aria-label={`Pagination ${itemLabel}`} className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-medium" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <CaretLeft size={14} weight="regular" /> Sebelumnya
        </Button>
        {getPageItems(page, totalPages).map((item, index) => typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            aria-label={`Halaman ${item}`}
            aria-current={page === item ? 'page' : undefined}
            onClick={() => onPageChange(item)}
            className={`flex size-8 items-center justify-center rounded-lg text-xs leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${page === item ? 'bg-sky-600 font-semibold text-white' : 'font-medium text-zinc-600 hover:bg-stone-100'}`}
          >
            {item}
          </button>
        ) : (
          <span key={`${item}-${index}`} aria-hidden="true" className="w-6 text-center text-xs font-bold tracking-wider text-stone-400">...</span>
        ))}
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-medium" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Berikutnya <CaretRight size={14} weight="regular" />
        </Button>
      </nav>
    </div>
  );
}
