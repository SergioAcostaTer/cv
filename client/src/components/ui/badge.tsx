import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn('inline-flex items-center rounded-full border border-slate-300 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700', className)}
    {...props}
  />
);
