import { FileCode2 } from 'lucide-react';
import { ChatInterface } from '../features/chat/ChatInterface';
import { LinkedinViewer } from '../features/viewers/LinkedinViewer';
import { ResumeViewer } from '../features/viewers/ResumeViewer';
import type { ArtifactKind, LinkedinJson, MarkdownSection, ResumeJson, ViewSelection } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui';

type MainAreaProps = {
  selectedArtifact: ViewSelection | null;
  sections: MarkdownSection[];
  kind: ArtifactKind;
  parsedJson: LinkedinJson | ResumeJson | Record<string, unknown> | null;
  rawContent: string;
  onCopySection: (text: string, label: string) => void;
};

const JsonFallback = ({ rawContent }: { rawContent: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm">
        <FileCode2 size={15} /> JSON Artifact
      </CardTitle>
    </CardHeader>
    <CardContent>
      <pre className="m-0 overflow-x-auto border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700">
        {rawContent}
      </pre>
    </CardContent>
  </Card>
);

export const MainArea = ({ selectedArtifact, sections, kind, parsedJson, rawContent, onCopySection }: MainAreaProps) => {
  if (!selectedArtifact) {
    return (
      <div className="mx-auto my-24 max-w-xl text-center text-slate-600">
        <h2 className="m-0 text-xl font-extrabold text-slate-800">Ready</h2>
        <p>Open a resume PDF or a LinkedIn/Roadmap JSON file from the left panel.</p>
      </div>
    );
  }

  if (selectedArtifact === 'chat') {
    return <ChatInterface />;
  }

  if (kind === 'pdf') {
    return (
      <iframe
        className="h-[62vh] w-full border border-slate-200 bg-white lg:h-[calc(100vh-200px)]"
        src={`/pdfs/${encodeURI(selectedArtifact.item.path)}`}
        title="resume-pdf"
      />
    );
  }

  if (kind === 'linkedin-json' && parsedJson) {
    return <LinkedinViewer data={parsedJson as LinkedinJson} onCopySection={onCopySection} />;
  }

  if (kind === 'resume-json' && parsedJson) {
    return <ResumeViewer data={parsedJson as ResumeJson} onCopySection={onCopySection} />;
  }

  if (kind === 'json') {
    return <JsonFallback rawContent={rawContent} />;
  }

  return (
    <div className="mx-auto my-24 max-w-xl text-center text-slate-600">
      <h2 className="m-0 text-xl font-extrabold text-slate-800">Unsupported Artifact</h2>
      <p>This file type cannot be previewed yet.</p>
    </div>
  );
};
