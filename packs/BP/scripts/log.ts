import { VERSION } from "./constants";

export type LogLevel = "warn" | "raise";

export class Logger {
  /**
   * @param filePath File path relative to `packs/BP/scripts`
   */
  constructor(private readonly filePath: string) {}

  /**
   * Make a log string
   * @param location the location of the log (eg. "playerBreakBlock event", "myFunction", "Class#method", "Class.staticMethod")
   * @param message the message
   * @returns the log string
   */
  private makeLogString(
    logLevel: LogLevel,
    location: string,
    message: string,
  ): string {
    return `[Advanced Storage Network v${VERSION}] (${this.filePath} - ${location}) ${logLevel.toUpperCase()} ${message}`;
  }

  /**
   * Log a warning
   * @param location the location of the log (eg. "playerBreakBlock event", "myFunction", "Class#method", "Class.staticMethod")
   * @param message the message
   */
  warn(location: string, message: string): void {
    console.warn(this.makeLogString("warn", location, message));
  }

  /**
   * Make a raise log string
   * @param location the location of the log (eg. "playerBreakBlock event", "myFunction", "Class#method", "Class.staticMethod")
   * @param message the message
   * @returns the log string
   * @example
   * ```ts
   * throw new Error(log.makeRaiseString("<global>", "error from global"));
   * ```
   */
  makeRaiseString(location: string, message: string): string {
    return this.makeLogString("raise", location, message);
  }
}
