import type { Icon } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';

interface OverviewMetricProps {
  label: string;
  value: number;
  note: string;
  icon: Icon;
  tileClassName: string;
  loading?: boolean;
}

export function OverviewMetric({ label, value, note, icon: MetricIcon, tileClassName, loading }: OverviewMetricProps) {
  return (
    <article className="flex flex-col rounded-xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-4 text-stone-500">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tileClassName)}>
          <MetricIcon weight="fill" className="size-4" />
        </span>
      </div>
      {loading ? (
        <span className="mt-3 block h-9 w-12 animate-pulse rounded-md bg-stone-100" aria-hidden="true" />
      ) : (
        <p className="mt-3 text-3xl font-bold leading-9 tabular-nums text-neutral-900">{value}</p>
      )}
      <p className="mt-1 text-xs leading-4 text-stone-500">{note}</p>
    </article>
  );
}
