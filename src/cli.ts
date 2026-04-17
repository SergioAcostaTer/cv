#!/usr/bin/env node

import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { run as runChat } from './commands/chat-cv';
import { runDashboard } from './commands/dashboard';
import { run as runBuild } from './commands/generate';
import { run as runLinkedin } from './commands/generate-linkedin';
import { run as runRoadmap } from './commands/roadmap';
import { loadEnv } from './utils/env-loader';
import { CliAbort, clearScreen, colors, outro, runCliEntry, secondary, unwrapCancel } from './utils/ui';

type CommandId = 'linkedin' | 'chat' | 'build' | 'roadmap' | 'dashboard' | 'exit';

export const main = async (): Promise<void> => {
  loadEnv();
  const brandIntro = `${pc.bold(colors.primary('CV Studio'))} ${secondary('blueprint CLI')}`;

  clearScreen();
  clack.intro(brandIntro);

  let running = true;

  while (running) {
    const selection = await clack.select({
      message: 'Choose a command',
      options: [
        { value: 'linkedin', label: 'LinkedIn Generator', hint: secondary('AI-tailored LinkedIn JSON') },
        { value: 'chat', label: 'Chat with CV', hint: secondary('Career advisor with live streaming') },
        { value: 'build', label: 'Build Resumes', hint: secondary('Render PDFs from Handlebars + Puppeteer') },
        {
          value: 'roadmap',
          label: 'Career Roadmap',
          hint: secondary('AI-generated career paths & salary optimization')
        },
        {
          value: 'dashboard',
          label: 'Local Dashboard',
          hint: secondary('Browse PDFs, LinkedIn drafts, and roadmaps in browser')
        },
        { value: 'exit', label: 'Exit', hint: secondary('Close the CLI') }
      ]
    });

    const command = unwrapCancel(selection, 'Session cancelled.') as CommandId;

    try {
      switch (command) {
        case 'linkedin':
          await runLinkedin([]);
          clearScreen();
          clack.intro(brandIntro);
          break;
        case 'chat':
          clearScreen();
          await runChat();
          clearScreen();
          clack.intro(brandIntro);
          break;
        case 'build':
          await runBuild();
          clearScreen();
          clack.intro(brandIntro);
          break;
        case 'roadmap':
          clearScreen();
          await runRoadmap();
          clearScreen();
          clack.intro(brandIntro);
          break;
        case 'dashboard':
          clearScreen();
          await runDashboard();
          clearScreen();
          clack.intro(brandIntro);
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
