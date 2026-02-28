import ora, { type Ora } from 'ora';

/** Whether the current process is running in a CI or non-TTY environment */
export function isCi(): boolean {
  return process.env.CI === 'true' || !process.stdout.isTTY;
}

/**
 * CI-aware spinner wrapper.
 * In interactive terminals, returns a normal ora spinner.
 * In CI/non-TTY, uses simple log lines instead of animated spinners.
 */
export function createSpinner(text: string): Ora {
  return ora({ text, isSilent: false, isEnabled: !isCi() });
}
