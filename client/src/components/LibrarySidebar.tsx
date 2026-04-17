import { AtSign, FileText, LibraryBig, Map } from 'lucide-react';
import type { ReactElement } from 'react';
import { categoryLabels } from '../features/library/constants';
import { formatDate } from '../features/library/format';
import type { Category, LibraryPayload } from '../types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from './ui';

type LibrarySidebarProps = {
  library: LibraryPayload;
  selectedKey: string | null;
  onSelect: (category: Category, index: number) => void;
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

      <div className="grid h-[calc(100%-84px)] gap-3 overflow-auto p-3">
        {(['resumes', 'linkedinDrafts', 'roadmaps'] as Category[]).map((category) => (
          <Card className="overflow-hidden border-slate-200 bg-white" key={category}>
            <CardHeader className="px-3 py-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                {categoryIcon[category]}
                {categoryLabels[category]}
              </CardTitle>
              <Badge variant="muted">{props.library[category].length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 p-2">
              {props.library[category].map((item, index) => {
                const key = `${category}:${item.path}`;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="ghost"
                    className={`h-auto w-full justify-start rounded-lg border px-3 py-2 text-left ${
                      props.selectedKey === key
                        ? 'border-slate-900 bg-slate-100 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-px hover:border-slate-300'
                    }`}
                    onClick={() => props.onSelect(category, index)}
                  >
                    <span className="block text-sm font-bold">{item.filename}</span>
                    <span className="mt-1 block font-mono text-xs text-slate-500">{formatDate(item.modifiedAt)}</span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </aside>
  );
};
