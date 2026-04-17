import { LibraryBig } from 'lucide-react';
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
  return (
    <aside className="min-h-0 overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_22px_56px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <header className="border-b border-slate-200/90 p-4">
        <h1 className="m-0 flex items-center gap-2 text-base font-extrabold tracking-tight">
          <LibraryBig size={18} /> CV Studio Library
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">Browse generated resumes, LinkedIn drafts and roadmaps.</p>
      </header>

      <div className="grid max-h-full gap-3 overflow-auto p-3">
        {(['resumes', 'linkedinDrafts', 'roadmaps'] as Category[]).map((category) => (
          <Card className="overflow-hidden bg-white/70" key={category}>
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm">{categoryLabels[category]}</CardTitle>
              <Badge>{props.library[category].length}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 p-2">
              {props.library[category].map((item, index) => {
                const key = `${category}:${item.path}`;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="secondary"
                    className={`h-auto w-full justify-start rounded-lg px-3 py-2 text-left ${
                      props.selectedKey === key
                        ? 'border-teal-300 bg-teal-50 text-slate-900'
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
