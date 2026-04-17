import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', {
  variants: {
    variant: {
      default: 'border-slate-300 bg-white/90 text-slate-700',
      brand: 'border-teal-200 bg-teal-50 text-teal-700',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      muted: 'border-slate-200 bg-slate-100 text-slate-600'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
