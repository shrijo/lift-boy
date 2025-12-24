/**
 * Logger Utility
 *
 * Centralized logging with environment-aware output.
 * Production builds suppress debug/info/warn logs.
 */

type LogLevel = "error" | "warn" | "info" | "debug";

interface Logger {
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

const isDev = import.meta.env.DEV;

/**
 * Application logger with environment-aware output
 *
 * - error: Always logged (dev + production)
 * - warn/info/debug: Only logged in development
 */
export const logger: Logger = {
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) console.warn(message, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    if (isDev) console.info(message, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) console.debug(message, ...args);
  },
};
