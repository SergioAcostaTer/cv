import { beforeEach, describe, expect, it, vi } from 'vitest';

const clackMocks = vi.hoisted(() => ({
  spinner: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@clack/prompts', () => clackMocks);

import {
    branded,
    clearPrintedLines,
    clearScreen,
    CliAbort,
    colors,
    createSpinner,
    info,
    note,
    outro,
    runCliEntry,
    secondary,
    streamChunk,
    success,
    unwrapCancel,
    warning
} from '../src/utils/ui';

describe('ui helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clackMocks.spinner.mockReset();
    clackMocks.isCancel.mockReset();
  });

  it('creates spinner with custom frames', () => {
    clackMocks.spinner.mockReturnValue({ start: vi.fn(), stop: vi.fn(), message: vi.fn() });

    createSpinner();

    expect(clackMocks.spinner).toHaveBeenCalledTimes(1);
    const options = clackMocks.spinner.mock.calls[0]?.[0];
    expect(options.frames).toEqual(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']);
    expect(options.delay).toBe(70);
    expect(typeof options.styleFrame).toBe('function');
    expect(options.styleFrame('x')).toBeTypeOf('string');
  });

  it('clears screen with ANSI reset code', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    clearScreen();

    expect(writeSpy).toHaveBeenCalledWith('\x1Bc');
  });

  it('clears the requested number of printed lines', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    clearPrintedLines(2);

    expect(writeSpy).toHaveBeenNthCalledWith(1, '\x1b[2K\r');
    expect(writeSpy).toHaveBeenNthCalledWith(2, '\x1b[1A');
    expect(writeSpy).toHaveBeenNthCalledWith(3, '\x1b[2K\r');
  });

  it('does not write when asked to clear negative lines', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    clearPrintedLines(-5);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('unwraps non-cancel values', () => {
    clackMocks.isCancel.mockReturnValue(false);

    const value = unwrapCancel('ok', 'cancelled');
    expect(value).toBe('ok');
  });

  it('throws CliAbort on cancel symbols', () => {
    clackMocks.isCancel.mockReturnValue(true);

    expect(() => unwrapCancel(Symbol('cancel'), 'cancelled')).toThrow(CliAbort);
    expect(clackMocks.cancel).toHaveBeenCalled();
  });

  it('exits with success code for CliAbort in runCliEntry', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      _code?: string | number | null | undefined
    ) => undefined as never) as typeof process.exit);

    runCliEntry(() => Promise.reject(new CliAbort('stop')));
    await new Promise((resolve) => setImmediate(resolve));

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with error code for unexpected failures in runCliEntry', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      _code?: string | number | null | undefined
    ) => undefined as never) as typeof process.exit);

    runCliEntry(() => Promise.reject(new Error('boom')));
    await new Promise((resolve) => setImmediate(resolve));

    expect(clackMocks.log.error).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles non-Error rejections in runCliEntry', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      _code?: string | number | null | undefined
    ) => undefined as never) as typeof process.exit);

    runCliEntry(() => Promise.reject('plain failure'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(clackMocks.log.error).toHaveBeenCalledWith(expect.any(String));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('routes note/info/success/outro helpers through clack formatters', () => {
    note('body', 'title');
    info('hello');
    success('done');
    warning('careful');
    outro('bye');

    expect(clackMocks.note).toHaveBeenCalled();
    expect(clackMocks.log.info).toHaveBeenCalled();
    expect(clackMocks.log.success).toHaveBeenCalled();
    expect(clackMocks.log.warn).toHaveBeenCalled();
    expect(clackMocks.outro).toHaveBeenCalled();
  });

  it('routes note helper without title', () => {
    note('body only');

    expect(clackMocks.note).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it('formats branded/secondary/stream chunks and color wrappers', () => {
    expect(branded('x')).toBeTypeOf('string');
    expect(secondary('x')).toBeTypeOf('string');
    expect(streamChunk('x')).toBeTypeOf('string');
    expect(colors.primary('x')).toBeTypeOf('string');
    expect(colors.accent('x')).toBeTypeOf('string');
  });
});
