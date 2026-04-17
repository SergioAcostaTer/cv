import { Copy, FileText } from 'lucide-react';
import { Button, Card, CardContent, CardFooter, CardHeader } from '../../components/ui';
import type { MarkdownSection } from '../../types';

type MarkdownViewerProps = {
  sections: MarkdownSection[];
  onCopySection: (text: string, label: string) => void;
};

export const MarkdownViewer = ({ sections, onCopySection }: MarkdownViewerProps) => {
  if (!sections.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {sections.map((section, index) => (
        <Card key={`${section.title}-${index}`} className="overflow-hidden rounded-xl bg-white">
          <CardHeader className="px-3 py-2">
            <p className="m-0 flex items-center gap-1.5 text-sm font-extrabold">
              <FileText size={14} /> {section.title}
            </p>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-slate-800">{section.markdown}</CardContent>
          <CardFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onCopySection(section.markdown, section.title)}>
              <Copy size={14} /> Copy Section
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
