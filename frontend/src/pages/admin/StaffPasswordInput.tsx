import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { staffModalInputClass } from './staffModalConfig';

export function StaffPasswordInput({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-stone-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required={required}
          minLength={required ? 8 : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`no-password-reveal ${staffModalInputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-500 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
