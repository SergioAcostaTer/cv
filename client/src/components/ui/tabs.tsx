import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export const Tabs = ({ value, onValueChange, children, className }: TabsProps) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={cn('grid gap-3', className)}>{children}</div>
  </TabsContext.Provider>
);

export const TabsList = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('inline-flex w-full items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1', className)}
    {...props}
  />
);

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export const TabsTrigger = ({ className, value, ...props }: TabsTriggerProps) => {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    return null;
  }

  const active = ctx.value === value;

  return (
    <button
      type="button"
      className={cn(
        'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  );
};

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export const TabsContent = ({ className, value, ...props }: TabsContentProps) => {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== value) {
    return null;
  }

  return <div className={cn('grid gap-3', className)} {...props} />;
};
