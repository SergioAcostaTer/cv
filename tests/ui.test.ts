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
    CliAbort,
    clearPrintedLines,
    clearScreen,
    createSpinner,
    runCliEntry,
    unwrapCancel
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
});
