import * as clack from '@clack/prompts';
import { highlight as highlightCode } from 'cli-highlight';
import fs from 'fs';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import path from 'path';
import { getAppPaths } from '../core/runtime';
import { createAIClient, getModelsForProvider, type ProviderId } from '../utils/api';
import {
    branded,
    clearPrintedLines,
    clearScreen,
    colors,
    createSpinner,
    error,
    note,
    runCliEntry,
    success,
    unwrapCancel,
    warning
} from '../utils/ui';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

let markdownConfigured = false;

const configureMarkdownRenderer = (): void => {
  if (markdownConfigured) {
    return;
  }

  marked.setOptions({
    renderer: new TerminalRenderer({
      reflowText: true,
      tab: 2
    }) as unknown as import('marked').Renderer,
    highlight: (code: string, lang?: string) =>
      highlightCode(code, {
        language: lang || 'json',
        ignoreIllegals: true
      })
  } as unknown as import('marked').MarkedOptions);

  markdownConfigured = true;
};

class CVChat {
  private conversationHistory: ChatMessage[] = [];
  private cvContext = '';
  private sourceFile = '';
  private provider: ProviderId = 'openai';
  private model = 'gpt-5-mini';

  private loadCVContext(): void {
    const { distDir, defaultResumePath, exampleResumePath } = getAppPaths();
    const linkedinPath = path.join(distDir, 'linkedin.json');

    if (fs.existsSync(linkedinPath)) {
      const data = JSON.parse(fs.readFileSync(linkedinPath, 'utf8')) as unknown;
      this.cvContext = JSON.stringify(data, null, 2);
      this.sourceFile = linkedinPath;
      success(`Loaded LinkedIn data from ${path.relative(process.cwd(), linkedinPath)}`);
      return;
    }

    if (fs.existsSync(defaultResumePath)) {
      const data = JSON.parse(fs.readFileSync(defaultResumePath, 'utf8')) as unknown;
      this.cvContext = JSON.stringify(data, null, 2);
      this.sourceFile = defaultResumePath;
      success(`Loaded resume from ${path.relative(process.cwd(), defaultResumePath)}`);
      return;
    }

    note(
      `No local resume JSON was found.\nCreate one at ${path.relative(process.cwd(), defaultResumePath)}.\nReference example: ${path.relative(process.cwd(), exampleResumePath)}`,
      'Create JSON First'
    );
  }

  private buildSystemPrompt(): string {
    return `You are an expert career advisor and professional communicator having a conversation with the user based on their CV or LinkedIn profile.

Your role is to:
- Answer questions about their career, experience, and skills
- Provide career advice and insights
- Suggest improvements or opportunities
- Help with career strategy and positioning
- Be conversational, helpful, and professional
- Keep responses concise but insightful

Here is the user's CV or LinkedIn profile data:

\`\`\`json
${this.cvContext}
\`\`\`

Use this information to provide contextual, personalized advice and discussion.`;
  }

  private async selectProviderAndModel(): Promise<void> {
    const provider = await clack.select({
      message: 'Choose an AI provider',
      options: [
        { value: 'openai', label: 'OpenAI' },
        { value: 'deepseek', label: 'DeepSeek' }
      ],
      initialValue: this.provider
    });

    this.provider = unwrapCancel(provider, 'Chat cancelled before provider selection.');

    const models = getModelsForProvider(this.provider);
    const model = await clack.select({
      message: 'Choose a chat model',
      options: models.map((item) => ({
        value: item.id,
        label: item.label
      })),
      initialValue: models.some((item) => item.id === this.model) ? this.model : models[0]?.id
    });

    this.model = unwrapCancel(model, 'Chat cancelled before model selection.');
  }

  private async streamCompletion(userMessage: string): Promise<void> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    const { client } = createAIClient({
      provider: this.provider,
      model: this.model
    });

    const spinner = createSpinner();
    spinner.start(`Contacting ${this.provider} (${this.model})`);

    const stream = await client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: this.conversationHistory
    });

    let response = '';
    let previewText = '';
    let outputStarted = false;
    let isThinkingMode = false;
    const cursor = '█';
    let cursorVisible = false;

    const hideCursor = (): void => {
      if (!cursorVisible) {
        return;
      }

      process.stdout.write('\x1b[1D \x1b[1D');
      cursorVisible = false;
    };

    const writePreview = (text: string): void => {
      if (!text) {
        return;
      }

      previewText += text;
      hideCursor();
      process.stdout.write(colors.muted(text));
      process.stdout.write(colors.muted(cursor));
      cursorVisible = true;
    };

    const startOutput = (status: string): void => {
      if (outputStarted) {
        return;
      }

      outputStarted = true;
      spinner.stop(status);
      process.stdout.write(`\n${branded('Assistant (streaming preview):')}\n`);
    };

    const writeTaggedContent = (chunkText: string): string => {
      const segments = chunkText.split(/(<think>|<\/think>)/iu);
      let visibleText = '';

      for (const segment of segments) {
        if (!segment) {
          continue;
        }

        const lowerSegment = segment.toLowerCase();
        if (lowerSegment === '<think>') {
          isThinkingMode = true;
          continue;
        }

        if (lowerSegment === '</think>') {
          isThinkingMode = false;
          continue;
        }

        if (isThinkingMode) {
          startOutput('Assistant is thinking');
          writePreview(segment);
          continue;
        }

        visibleText += segment;
      }

      return visibleText;
    };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as { content?: string; reasoning_content?: string } | undefined;
      const reasoningContent = delta?.reasoning_content;

      if (reasoningContent) {
        startOutput('Assistant is thinking');
        writePreview(reasoningContent);
      }

      const content = delta?.content;
      if (!content) {
        continue;
      }

      const visibleContent = writeTaggedContent(content);
      if (!visibleContent) {
        continue;
      }

      if (!response) {
        startOutput('Assistant is responding');
      }

      response += visibleContent;
      writePreview(visibleContent);
    }

    if (outputStarted) {
      hideCursor();
      const previewLines = previewText.split(/\r?\n/u).length + 1;
      process.stdout.write('\n');
      clearPrintedLines(previewLines);

      process.stdout.write(`${branded('Assistant:')}\n`);
      const rendered = marked.parse(response);
      const output = typeof rendered === 'string' ? rendered : await rendered;
      process.stdout.write(`${output}${output.endsWith('\n') ? '' : '\n'}\n`);
    } else {
      spinner.stop('Assistant response was empty');
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response
    });
  }

  async start(): Promise<void> {
    await this.selectProviderAndModel();
    this.loadCVContext();

    if (!this.cvContext) {
      return;
    }

    this.conversationHistory = [
      {
        role: 'system',
        content: this.buildSystemPrompt()
      }
    ];

    note(
      `Source: ${path.relative(process.cwd(), this.sourceFile)}\nProvider: ${this.provider}\nModel: ${this.model}\nCommands: /help /clear /reload /exit`,
      'Career Chat'
    );

    while (true) {
      const userInput = await clack.text({
        message: 'You',
        placeholder: 'Ask about your CV, strengths, or positioning'
      });

      const trimmed = unwrapCancel(userInput, 'Chat closed.').trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith('/')) {
        switch (trimmed.toLowerCase()) {
          case '/exit':
            success('Career chat closed.');
            return;
          case '/clear':
            this.conversationHistory = [
              {
                role: 'system',
                content: this.buildSystemPrompt()
              }
            ];
            success('Conversation history cleared.');
            continue;
          case '/help':
            note('/clear resets the conversation\n/reload reloads the current JSON source\n/exit returns to the main menu', 'Commands');
            continue;
          case '/reload':
            this.loadCVContext();
            if (!this.cvContext) {
              return;
            }
            this.conversationHistory = [
              {
                role: 'system',
                content: this.buildSystemPrompt()
              }
            ];
            success('CV data reloaded.');
            continue;
          default:
            warning(`Unknown command: ${trimmed}`);
            continue;
        }
      }

      try {
        await this.streamCompletion(trimmed);
      } catch (chatError: unknown) {
        error(chatError instanceof Error ? chatError.message : String(chatError));
      }
    }
  }
}

export const run = async (): Promise<void> => {
  configureMarkdownRenderer();
  clearScreen();
  const chat = new CVChat();
  await chat.start();
};

if (require.main === module) {
  runCliEntry(run);
}
