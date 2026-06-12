export class Logger {
  private static isDebugEnabled = false;

  /**
   * Contract:
   * Initializes the global logger configuration.
   * If debug mode is set to true, all subsequent logs will be output to the browser console.
   * If false, logging functions become no-ops.
   * 
   * @param {boolean} [debug=false] - Whether to enable console debugging output.
   * @returns {void}
   */
  static init(debug: boolean = false): void {
    this.isDebugEnabled = debug;
  }

  /**
   * Contract:
   * Returns the current debug configuration state of the Logger.
   * Useful for conditionally executing expensive debugging operations outside the Logger itself.
   * 
   * @returns {boolean} True if debugging is enabled, false otherwise.
   */
  static get isDebug(): boolean {
    return this.isDebugEnabled;
  }

  /**
   * Contract:
   * Outputs a standard log message to `console.log` if debugging is enabled.
   * Prepends the Tracking SDK prefix and the provided context area (e.g. `[Tracking SDK] [Network] ...`).
   * 
   * @param {string} context - The subsystem generating the log (e.g., "VisitorManager").
   * @param {string} message - The primary text message to log.
   * @param {...any[]} args - Optional additional arguments or objects to inspect.
   * @returns {void}
   */
  static log(context: string, message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.log(`[Tracking SDK] [${context}] ${message}`, ...args);
    }
  }

  /**
   * Contract:
   * Outputs a warning message to `console.warn` if debugging is enabled.
   * Follows the same prefix formatting as standard logs.
   * 
   * @param {string} context - The subsystem generating the warning.
   * @param {string} message - The primary warning message.
   * @param {...any[]} args - Optional additional arguments or objects to inspect.
   * @returns {void}
   */
  static warn(context: string, message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.warn(`[Tracking SDK] [${context}] ${message}`, ...args);
    }
  }

  /**
   * Contract:
   * Outputs an error message to `console.error` if debugging is enabled.
   * Follows the same prefix formatting as standard logs. Used for critical faults.
   * 
   * @param {string} context - The subsystem generating the error.
   * @param {string} message - The primary error message.
   * @param {...any[]} args - Optional additional arguments, typically Error objects.
   * @returns {void}
   */
  static error(context: string, message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.error(`[Tracking SDK] [${context}] ${message}`, ...args);
    }
  }
}
