import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';

import { cn } from '../../lib/utils';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'left',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col gap-4 bg-white shadow-xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-400',
          side === 'left' && 'inset-y-0 left-0 h-full w-[85%] max-w-xs border-r border-stone-200 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          side === 'right' && 'inset-y-0 right-0 h-full w-[85%] max-w-xs border-l border-stone-200 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          side === 'top' && 'inset-x-0 top-0 h-auto border-b border-stone-200 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
          side === 'bottom' && 'inset-x-0 bottom-0 h-auto border-t border-stone-200 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-slot="sheet-close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-stone-500 opacity-80 transition hover:bg-stone-100 hover:text-neutral-900 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <X weight="bold" className="size-5" />
          <span className="sr-only">Tutup</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5 px-6 pt-6', className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-neutral-900 text-lg font-bold', className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-stone-500 text-sm', className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetOverlay, SheetPortal };
