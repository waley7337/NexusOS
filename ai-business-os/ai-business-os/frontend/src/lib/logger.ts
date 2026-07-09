import { env } from "@/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  if (env.isDev) return true;
  return LEVEL_ORDER[level] >= LEVEL_ORDER.warn;
}

function formatMessage(level: LogLevel, message: string, context?: unknown): string {
  const prefix = `[NexusOS:${level}]`;
  if (context !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, context?: unknown) {
    if (shouldLog("debug")) console.debug(formatMessage("debug", message, context));
  },
  info(message: string, context?: unknown) {
    if (shouldLog("info")) console.info(formatMessage("info", message, context));
  },
  warn(message: string, context?: unknown) {
    if (shouldLog("warn")) console.warn(formatMessage("warn", message, context));
  },
  error(message: string, context?: unknown) {
    if (shouldLog("error")) console.error(formatMessage("error", message, context));
  },
};
