import * as clack from '@clack/prompts';
import pc from 'picocolors';

export class CliAbort extends Error {
  constructor(message = 'Operation cancelled.') {
    super(message);
    this.name = 'CliAbort';
  }
}

export const colors = {
  primary: (value: string): string => pc.blue(value),
  accent: (value: string): string => pc.cyan(value),
  muted: (value: string): string => pc.dim(value),
  danger: (value: string): string => pc.red(value)
};

export const branded = (value: string): string => colors.accent(value);
export const secondary = (value: string): string => colors.muted(value);
export const streamChunk = (value: string): string => colors.accent(value);

export const note = (message: string, title?: string): void => {
  clack.note(colors.muted(message), title ? colors.accent(title) : undefined);
};

export const info = (message: string): void => {
  clack.log.info(colors.muted(message));
};

export const success = (message: string): void => {
  clack.log.success(colors.accent(message));
};

export const warning = (message: string): void => {
  clack.log.warn(colors.muted(message));
};

export const error = (message: string): void => {
  clack.log.error(colors.danger(message));
};

export const outro = (message: string): void => {
  clack.outro(colors.primary(message));
};

export const cancelWithMessage = (message: string): never => {
  clack.cancel(colors.muted(message));
  throw new CliAbort(message);
};

export const unwrapCancel = <T>(value: T | symbol, message: string): T => {
  if (clack.isCancel(value)) {
    cancelWithMessage(message);
  }

  return value as T;
};
