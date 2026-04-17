import { Send } from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useRef, useState } from 'react';
import { Button, Textarea } from '../../components/ui';
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
    <div className="flex h-full min-h-0 flex-col border border-border bg-background">
      <div ref={scrollContainerRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {!messages.length ? (
          <p className="m-0 text-sm text-muted-foreground">Start a conversation about your CV, LinkedIn profile, or career strategy.</p>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-4xl rounded-md border border-border p-3 ${
              message.role === 'user'
                ? 'ml-auto w-[85%] bg-primary text-primary-foreground'
                : 'mr-auto w-[95%] bg-muted/50 text-foreground'
            }`}
          >
            {message.role === 'assistant' ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-6"
                dangerouslySetInnerHTML={{ __html: marked.parse(message.content) as string }}
              />
            ) : (
              <p className="m-0 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            )}
          </div>
        ))}
      </div>

      <form
        className="sticky bottom-0 border-t border-border bg-background p-3"
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
