import chalk from 'chalk';

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Creates a structured logger. debug() output is suppressed unless verbose is true. */
export function createLogger(verbose = false): Logger {
  return {
    debug(...args: unknown[]) {
      if (verbose) {
        console.log(chalk.gray('[debug]'), ...args);
      }
    },
    info(...args: unknown[]) {
      console.log(...args);
    },
    warn(...args: unknown[]) {
      console.warn(chalk.yellow('[warn]'), ...args);
    },
    error(...args: unknown[]) {
      console.error(chalk.red('[error]'), ...args);
    },
  };
}

/** Singleton no-op logger for when logging is not needed */
export const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
