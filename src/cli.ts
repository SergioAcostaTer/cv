#!/usr/bin/env node

import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { run as runChat } from './commands/chat-cv';
import { runDashboard } from './commands/dashboard';
import { run as runBuild, type BuildOptions } from './commands/generate';
import { run as runLinkedin, type LinkedinRunOptions } from './commands/generate-linkedin';
import { run as runRoadmap } from './commands/roadmap';
import { loadEnv } from './utils/env-loader';
import { CliAbort, clearScreen, colors, outro, runCliEntry, secondary, unwrapCancel } from './utils/ui';

const { cac } = require('cac') as { cac: (name?: string) => any };

type CommandId = 'linkedin' | 'chat' | 'build' | 'roadmap' | 'dashboard' | 'exit';

const runInteractiveMenu = async (): Promise<void> => {
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
          await runLinkedin();
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

export const main = async (): Promise<void> => {
  loadEnv();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await runInteractiveMenu();
    return;
  }

  const cli = cac('cv');

  cli
    .command('linkedin', 'Generate LinkedIn profile artifacts')
    .option('--provider <provider>', 'AI provider (openai|deepseek)')
    .option('--model <model>', 'Model id for generation')
    .option('--languages <codes>', 'Comma-separated language codes, e.g. en,es')
    .option('--api-key <key>', 'Override provider API key')
    .option('--base-url <url>', 'Override provider base URL')
    .action(async (options: LinkedinRunOptions) => {
      await runLinkedin(options);
    });

  cli
    .command('chat', 'Start CV chat advisor')
    .action(async () => {
      await runChat();
    });

  cli
    .command('build', 'Build resume PDFs')
    .option('--theme <theme>', 'Theme name from themes directory')
    .option('--watch', 'Watch source files and rebuild')
    .action(async (options: BuildOptions) => {
      await runBuild(options);
    });

  cli
    .command('roadmap', 'Generate AI career roadmap')
    .action(async () => {
      await runRoadmap();
    });

  cli
    .command('dashboard', 'Launch local dashboard server')
    .action(async () => {
      await runDashboard();
    });

  cli.help();

  await cli.parse();
};

if (require.main === module) {
  runCliEntry(main);
}
