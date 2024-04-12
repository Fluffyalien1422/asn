import { VERSION } from "./constants";

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
    logLevel: string,
    location: string,
    message: string,
  ): string {
    return `[Advanced Storage Network v${VERSION}] (${this.filePath} - ${location}) ${logLevel} ${message}`;
  }

  /**
   * Log a warning
   * @param location the location of the log (eg. "playerBreakBlock event", "myFunction", "Class#method", "Class.staticMethod")
   * @param message the message
   */
  warn(location: string, message: string): void {
    console.warn(this.makeLogString("WARN", location, message));
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
    return this.makeLogString("RAISE", location, message);
  }

  /**
   * Log info (does not show on content log GUI)
   * @param location the location of the log (eg. "playerBreakBlock event", "myFunction", "Class#method", "Class.staticMethod")
   * @param message the message
   */
  info(location: string, message: string): void {
    console.info(this.makeLogString("INFO", location, message));
  }

  /**
   * Log a debug message (shows on content log GUI)
   * @param location the location of the log (eg. "playerBreakBlock event", "myFunction", "Class#method", "Class.staticMethod")
   * @param message the message
   */
  msg(location: string, message: string): void {
    console.warn(this.makeLogString("MSG", location, message));
  }
}
