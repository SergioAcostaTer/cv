#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from 'enquirer';
import * as path from 'path';
import { loadEnv } from './lib/env-loader';

// Load environment variables from .env
loadEnv();

// ANSI Colors & Styles
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
};

type Color = keyof typeof COLORS;

const style = (text: string, ...styles: Color[]): string => {
  return styles.reduce((acc, s) => COLORS[s] + acc, text) + COLORS.reset;
};

const COMMANDS = [
  { name: style('🤖 LinkedIn Generator', 'cyan', 'bright'), value: 'linkedin' },
  { name: style('💬 Chat with CV', 'green', 'bright'), value: 'chat' },
  { name: style('🏗️  Build Resumes', 'yellow', 'bright'), value: 'build' },
  { name: style('🚪 Exit', 'dim'), value: 'exit' }
];

const runCommand = (scriptPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn('tsx', [scriptPath], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Process exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', reject);
  });
};

const printHeader = (): void => {
  console.clear();
  const width = 56;
  const line = '─'.repeat(width);
  
  console.log();
  console.log(style('  ' + line, 'cyan', 'dim'));
  console.log(style('  │', 'cyan', 'dim') + style('  CV Generator Suite', 'bold', 'cyan') + style('  │', 'cyan', 'dim'));
  console.log(style('  │', 'cyan', 'dim') + style('  Professional Resume & Interview AI', 'dim', 'cyan') + style('  │', 'cyan', 'dim'));
  console.log(style('  ' + line, 'cyan', 'dim'));
  console.log();
};

const printFooter = (): void => {
  console.log();
  console.log(style('  ' + '─'.repeat(56), 'dim'));
};

const main = async (): Promise<void> => {
  printHeader();

  let running = true;

  while (running) {
    try {
      const answer = await select({
        name: 'command',
        message: style('Select an option:', 'bright'),
        choices: COMMANDS,
        result() {
          return this.focused.value;
        }
      });

      console.log();

      let startMsg = '';
      let emoji = '';

      switch (answer) {
        case 'linkedin':
          emoji = '🤖';
          startMsg = 'LinkedIn Generator';
          console.log(style(`  ${emoji}  Initializing ${startMsg}...`, 'cyan', 'bright'));
          printFooter();
          console.log();
          await runCommand(path.join(__dirname, 'generate-linkedin.ts'));
          break;
        case 'chat':
          emoji = '💬';
          startMsg = 'Chat Interface';
          console.log(style(`  ${emoji}  Initializing ${startMsg}...`, 'green', 'bright'));
          printFooter();
          console.log();
          await runCommand(path.join(__dirname, 'chat-cv.ts'));
          break;
        case 'build':
          emoji = '🏗️ ';
          startMsg = 'Resume Builder';
          console.log(style(`  ${emoji} Initializing ${startMsg}...`, 'yellow', 'bright'));
          printFooter();
          console.log();
          await runCommand(path.join(__dirname, 'generate.ts'));
          break;
        case 'exit':
          console.log();
          console.log(style('  👋  Thanks for using CV Generator!', 'dim', 'cyan'));
          printFooter();
          console.log();
          running = false;
          break;
      }

      if (running) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        printHeader();
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Prompt was cancelled')) {
        console.log();
        console.log(style(`  ✗ Error: ${error.message}`, 'red', 'bright'));
        console.log();
      }
      running = false;
    }
  }
};

main().catch((error) => {
  console.error(style(`  ✗ Fatal error: ${error}`, 'red', 'bright'));
  process.exit(1);
});
