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
    className={cn('inline-flex w-full items-center gap-1 rounded-md border border-border bg-muted p-1', className)}
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
        'flex-1 rounded-sm px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200',
        active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground',
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
