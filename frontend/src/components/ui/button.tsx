import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
  {
    variants: {
      variant: {
        default: 'bg-sky-600 text-white shadow-sm hover:bg-sky-700',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline: 'border border-stone-200 bg-white text-neutral-900 hover:bg-stone-50 hover:text-neutral-900',
        secondary: 'bg-stone-100 text-neutral-900 hover:bg-stone-200',
        ghost: 'text-stone-600 hover:bg-stone-100 hover:text-neutral-900',
        link: 'text-sky-700 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 [&_svg]:size-4',
        sm: 'h-9 rounded-lg px-3 text-xs [&_svg]:size-4',
        lg: 'h-11 rounded-xl px-8 [&_svg]:size-5',
        icon: 'h-10 w-10 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
