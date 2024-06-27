import { VERSION_STR } from "./constants";

function makeLogString(logLevel: string, message: string): string {
  return `[Advanced Storage Network v${VERSION_STR}] ${logLevel} ${message}`;
}

export function logInfo(message: string): void {
  console.info(makeLogString("INFO", message));
}

export function logWarn(message: string): void {
  console.warn(makeLogString("WARN", message));
}

export function makeErrorString(message: string): string {
  return makeLogString("ERROR", message);
}
