import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-tight', {
  variants: {
    variant: {
      default: 'bg-sky-100 text-sky-700',
      secondary: 'bg-stone-100 text-stone-700',
      outline: 'border border-stone-200 bg-white text-stone-600',
      success: 'bg-emerald-100 text-emerald-700',
      warning: 'bg-amber-100 text-amber-800',
      destructive: 'bg-rose-100 text-red-700',
      neutral: 'bg-zinc-100 text-neutral-800',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
