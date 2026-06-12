export class Logger {
  private static isDebugEnabled = false;

  static init(debug: boolean = false) {
    this.isDebugEnabled = debug;
  }

  static get isDebug(): boolean {
    return this.isDebugEnabled;
  }

  static log(context: string, message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.log(`[Tracking SDK] [${context}] ${message}`, ...args);
    }
  }

  static warn(context: string, message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.warn(`[Tracking SDK] [${context}] ${message}`, ...args);
    }
  }

  static error(context: string, message: string, ...args: any[]): void {
    if (this.isDebugEnabled) {
      console.error(`[Tracking SDK] [${context}] ${message}`, ...args);
    }
  }
}
