import { Copy, RefreshCw } from 'lucide-react';
import { Button } from './ui';

type MainToolbarProps = {
  title: string;
  showCopyAll: boolean;
  onCopyAll: () => void;
  onRefresh: () => void;
};

export const MainToolbar = (props: MainToolbarProps) => {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <p className="m-0 max-w-[55%] truncate text-sm font-bold">{props.title}</p>
      <div className="flex items-center gap-2">
        {props.showCopyAll ? (
          <Button
            type="button"
            variant="outline"
            onClick={props.onCopyAll}
          >
            <Copy size={14} /> Copy All
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={props.onRefresh}
        >
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>
    </header>
  );
};
