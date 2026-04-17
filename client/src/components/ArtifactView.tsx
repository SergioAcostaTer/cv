import { Copy, FileText } from 'lucide-react';
import type { MarkdownSection, Selection } from '../types';
import { Button, Card, CardContent, CardHeader } from './ui';

type ArtifactViewProps = {
  selectedArtifact: Selection | null;
  sections: MarkdownSection[];
  onCopySection: (text: string, label: string) => void;
};

export const ArtifactView = (props: ArtifactViewProps) => {
  if (!props.selectedArtifact) {
    return (
      <div className="mx-auto my-24 max-w-xl text-center text-slate-600">
        <h2 className="m-0 text-xl font-extrabold text-slate-800">Ready</h2>
        <p>Open a PDF, LinkedIn draft, or roadmap from the left panel.</p>
      </div>
    );
  }

  if (props.selectedArtifact.category === 'resumes') {
    return (
      <iframe
        className="h-[62vh] w-full rounded-xl border border-slate-200 bg-white lg:h-[calc(100vh-200px)]"
        src={`/pdfs/${encodeURI(props.selectedArtifact.item.path)}`}
        title="resume-pdf"
      />
    );
  }

  return (
    <div className="grid gap-3">
      {props.sections.map((section, index) => (
        <Card key={`${section.title}-${index}`} className="overflow-hidden rounded-xl bg-white">
          <CardHeader className="px-3 py-2">
            <p className="m-0 flex items-center gap-1.5 text-sm font-extrabold">
              <FileText size={14} /> {section.title}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => props.onCopySection(section.markdown, section.title)}
            >
              <Copy size={14} /> Copy Section
            </Button>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-slate-800">{section.markdown}</CardContent>
        </Card>
      ))}
    </div>
  );
};
