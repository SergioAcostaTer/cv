import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white hover:bg-slate-800',
        secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
        brand: 'border border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
        ghost: 'border border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100',
        outline: 'border border-slate-300 bg-transparent text-slate-800 hover:bg-slate-100'
      },
      size: {
        default: 'h-9 px-3 py-2',
        sm: 'h-8 px-2.5',
        lg: 'h-10 px-4',
        icon: 'h-8 w-8 rounded-full p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = ({ className, variant, size, ...props }: ButtonProps) => {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
};
