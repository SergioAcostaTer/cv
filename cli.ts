#!/usr/bin/env node

import { spawn } from 'child_process';
import { select } from 'enquirer';
import * as path from 'path';

const COMMANDS = [
  { name: 'LinkedIn Generator', value: 'linkedin' },
  { name: 'Chat with CV', value: 'chat' },
  { name: 'Build Resumes', value: 'build' },
  { name: 'Exit', value: 'exit' }
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

const main = async (): Promise<void> => {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║  📋 CV Generator CLI                   ║');
  console.log('╚════════════════════════════════════════╝\n');

  let running = true;

  while (running) {
    try {
      const answer = await select({
        name: 'command',
        message: 'What would you like to do?',
        choices: COMMANDS,
        result() {
          return this.focused.value;
        }
      });

      console.log();

      switch (answer) {
        case 'linkedin':
          console.log('🚀 Starting LinkedIn Generator...\n');
          await runCommand(path.join(__dirname, 'generate-linkedin.ts'));
          break;
        case 'chat':
          console.log('💬 Starting Chat...\n');
          await runCommand(path.join(__dirname, 'chat-cv.ts'));
          break;
        case 'build':
          console.log('🏗️  Building Resumes...\n');
          await runCommand(path.join(__dirname, 'generate.ts'));
          break;
        case 'exit':
          console.log('\n👋 Goodbye!\n');
          running = false;
          break;
      }

      if (running) {
        console.log('\n' + '─'.repeat(42) + '\n');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Prompt was cancelled')) {
        console.error('Error:', error.message);
      }
      running = false;
    }
  }
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
