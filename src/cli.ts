#!/usr/bin/env node

import * as clack from '@clack/prompts';
import { run as runChat } from './commands/chat-cv';
import { run as runBuild } from './commands/generate';
import { run as runLinkedin } from './commands/generate-linkedin';
import { loadEnv } from './utils/env-loader';
import { CliAbort, outro, runCliEntry, secondary, unwrapCancel } from './utils/ui';

type CommandId = 'linkedin' | 'chat' | 'build' | 'exit';

export const main = async (): Promise<void> => {
  loadEnv();
  clack.intro(`CV Studio ${secondary('blueprint CLI')}`);

  let running = true;

  while (running) {
    const selection = await clack.select({
      message: 'Choose a command',
      options: [
        { value: 'linkedin', label: 'LinkedIn Generator', hint: secondary('AI-tailored LinkedIn JSON') },
        { value: 'chat', label: 'Chat with CV', hint: secondary('Career advisor with live streaming') },
        { value: 'build', label: 'Build Resumes', hint: secondary('Render PDFs from Handlebars + Puppeteer') },
        { value: 'exit', label: 'Exit', hint: secondary('Close the CLI') }
      ]
    });

    const command = unwrapCancel(selection, 'Session cancelled.') as CommandId;

    try {
      switch (command) {
        case 'linkedin':
          await runLinkedin([]);
          break;
        case 'chat':
          await runChat();
          break;
        case 'build':
          await runBuild();
          break;
        case 'exit':
          running = false;
          break;
      }
    } catch (commandError: unknown) {
      if (commandError instanceof CliAbort) {
        continue;
      }

      throw commandError;
    }
  }

  outro('Session closed.');
};

if (require.main === module) {
  runCliEntry(main);
}
