import * as React from 'react';

import { cn } from '../../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm text-zinc-900 shadow-sm transition outline-none',
        'placeholder:text-stone-400',
        'focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:border-sky-500',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
