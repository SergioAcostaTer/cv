import { AtSign, FileText, LibraryBig, Map } from 'lucide-react';
import type { ReactElement } from 'react';
import { categoryLabels } from '../features/library/constants';
import { formatDate } from '../features/library/format';
import type { Category, LibraryPayload } from '../types';
import { Badge, Button } from './ui';

type LibrarySidebarProps = {
  library: LibraryPayload;
  selectedKey: string | null;
  onSelect: (category: Category, index: number) => void;
  onNewChat: () => void;
  isChatSelected: boolean;
};

export const LibrarySidebar = (props: LibrarySidebarProps) => {
  const categoryIcon: Record<Category, ReactElement> = {
    resumes: <FileText size={14} />,
    linkedinDrafts: <AtSign size={14} />,
    roadmaps: <Map size={14} />
  };

  return (
    <aside className="min-h-0 overflow-hidden border-b border-slate-200 bg-white lg:border-r lg:border-b-0">
      <header className="border-b border-slate-200 px-4 py-3">
        <h1 className="m-0 flex items-center gap-2 text-base font-extrabold tracking-tight">
          <LibraryBig size={18} /> CV Studio Library
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">Browse resumes, LinkedIn assets and roadmap outputs.</p>
      </header>

      <div className="grid h-[calc(100%-84px)] gap-4 overflow-auto p-3">
        <Button
          type="button"
          variant={props.isChatSelected ? 'secondary' : 'outline'}
          className="w-full justify-start"
          onClick={props.onNewChat}
        >
          New Chat
        </Button>

        {(['resumes', 'linkedinDrafts', 'roadmaps'] as Category[]).map((category) => (
          <section className="grid gap-1" key={category}>
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">{categoryLabels[category]}</p>
              <Badge variant="muted">{props.library[category].length}</Badge>
            </div>

            {props.library[category].map((item, index) => {
              const key = `${category}:${item.path}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={`grid w-full gap-1 px-2 py-2 text-left text-sm transition-colors ${
                    props.selectedKey === key
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-100/50 hover:text-slate-900'
                  }`}
                  onClick={() => props.onSelect(category, index)}
                >
                  <span className="flex items-center gap-1.5">
                    {categoryIcon[category]}
                    {item.filename}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{formatDate(item.modifiedAt)}</span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
};
