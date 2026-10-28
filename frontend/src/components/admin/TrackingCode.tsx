import { useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';

export function TrackingCode({ code }: { code?: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard bisa diblokir browser; nomor resi tetap terlihat untuk disalin manual.
    }
  };

  return (
    <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 tracking-tight text-stone-500">
      <span>Resi:</span>
      <span className="font-mono font-semibold text-stone-600">{code}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Salin nomor resi ${code}`}
        title={copied ? 'Nomor resi tersalin' : 'Salin nomor resi'}
        className="inline-flex size-5 items-center justify-center rounded text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {copied ? <Check size={12} weight="bold" className="text-emerald-600" /> : <Copy size={12} weight="bold" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Nomor resi tersalin' : ''}
      </span>
    </span>
  );
}
