import { Send } from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Textarea } from '../../components/ui';
import { useChat } from './useChat';

export const ChatInterface = () => {
  const { messages, isLoading, sendMessage } = useChat();
  const [draft, setDraft] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col border border-slate-200 bg-white">
      <div ref={scrollContainerRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {!messages.length ? (
          <p className="m-0 text-sm text-slate-500">Start a conversation about your CV, LinkedIn profile, or career strategy.</p>
        ) : null}

        {messages.map((message, index) => (
          <Card
            key={`${message.role}-${index}`}
            className={`max-w-4xl p-3 ${message.role === 'user' ? 'ml-auto w-[85%] bg-slate-900 text-slate-50' : 'mr-auto w-[95%] bg-white text-slate-900'}`}
          >
            {message.role === 'assistant' ? (
              <div
                className="prose prose-slate max-w-none text-sm leading-6"
                dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }}
              />
            ) : (
              <p className="m-0 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            )}
          </Card>
        ))}
      </div>

      <form
        className="sticky bottom-0 border-t border-slate-200 bg-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(draft);
          setDraft('');
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask for a better LinkedIn headline, role summary, or interview prep response..."
            className="min-h-[72px] resize-y"
          />
          <Button type="submit" disabled={isLoading || !draft.trim()}>
            <Send size={14} />
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};
