import * as React from 'react';

import { cn } from '../../lib/utils';

function RadioGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="radio-group"
      role="radiogroup"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

type RadioGroupItemProps = Omit<React.ComponentProps<'input'>, 'type'>;

function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
  return (
    <span className={cn('relative inline-grid size-5 shrink-0 place-items-center', className)}>
      <input
        data-slot="radio-group-item"
        type="radio"
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none size-5 rounded-full border-2 border-stone-300 bg-white transition-colors peer-checked:border-sky-600 peer-checked:bg-sky-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-2 scale-0 rounded-full bg-white transition-transform peer-checked:scale-100"
      />
    </span>
  );
}

export { RadioGroup, RadioGroupItem };
