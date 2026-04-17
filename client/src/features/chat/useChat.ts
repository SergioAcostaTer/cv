import { useCallback, useState } from 'react';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatApiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const toApiMessages = (messages: ChatMessage[]): ChatApiMessage[] =>
  messages.map((message) => ({
    role: message.role,
    content: message.content
  }));

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
      setMessages([...nextMessages, { role: 'assistant', content: '' }]);
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: toApiMessages(nextMessages) })
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to stream chat response.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            continue;
          }

          setMessages((prev) => {
            if (!prev.length) {
              return prev;
            }

            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role !== 'assistant') {
              return prev;
            }

            updated[updated.length - 1] = {
              ...last,
              content: `${last.content}${chunk}`
            };

            return updated;
          });
        }
      } catch (error) {
        const fallback = error instanceof Error ? error.message : 'Unknown chat error';
        setMessages((prev) => {
          if (!prev.length) {
            return prev;
          }

          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role !== 'assistant') {
            return prev;
          }

          updated[updated.length - 1] = {
            ...last,
            content: `Chat error: ${fallback}`
          };

          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  return {
    messages,
    isLoading,
    sendMessage
  };
};
