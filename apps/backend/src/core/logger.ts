import { config, isDevelopment } from "@/config"

/**
 * Log levels
 */
export enum LogLevel {
  NONE = -1,
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.NONE]: "NONE",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.TRACE]: "TRACE",
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.NONE]: "\x1b[0m", // Reset/None
  [LogLevel.ERROR]: "\x1b[31m", // Red
  [LogLevel.WARN]: "\x1b[33m", // Yellow
  [LogLevel.INFO]: "\x1b[36m", // Cyan
  [LogLevel.DEBUG]: "\x1b[35m", // Magenta
  [LogLevel.TRACE]: "\x1b[37m", // White
}

const RESET_COLOR = "\x1b[0m"

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * Logger interface
 */
export interface ILogger {
  error(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
  trace(message: string, context?: Record<string, unknown>): void
  child(context: Record<string, unknown>): ILogger
}

/**
 * Parse log level from string
 */
function parseLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case "none":
      return LogLevel.NONE
    case "error":
      return LogLevel.ERROR
    case "warn":
      return LogLevel.WARN
    case "info":
      return LogLevel.INFO
    case "debug":
      return LogLevel.DEBUG
    case "trace":
      return LogLevel.TRACE
    default:
      return LogLevel.INFO
  }
}

/**
 * Structured logger implementation
 */
export class Logger implements ILogger {
  private currentLevel: LogLevel
  private contextData: Record<string, unknown>

  public constructor(
    level: LogLevel = LogLevel.INFO,
    context: Record<string, unknown> = {},
  ) {
    this.currentLevel = level
    this.contextData = context
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: Record<string, unknown>): ILogger {
    return new Logger(this.currentLevel, {
      ...this.contextData,
      ...context,
    })
  }

  /**
   * Log error message
   */
  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context)
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * Log info message
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * Log debug message
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Log trace message
   */
  public trace(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, context)
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    if (level > this.currentLevel) {
      return
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      message,
    }

    // Merge context and serialize Error instances
    const mergedContext = this.serializeContext({
      ...this.contextData,
      ...context,
    })

    if (Object.keys(mergedContext).length > 0) {
      logEntry.context = mergedContext
    }

    // Extract error if present in the 'error' field
    if (context?.error instanceof Error) {
      logEntry.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack,
      }
      // Remove error from context to avoid duplication
      const { error: _error, ...restContext } = mergedContext
      if (Object.keys(restContext).length > 0) {
        logEntry.context = restContext
      } else {
        delete logEntry.context
      }
    }

    if (isDevelopment) {
      this.logPretty(level, logEntry)
    } else {
      this.logJson(logEntry)
    }
  }

  /**
   * Serialize context, converting Error instances to plain objects.
   * Non-error values are left unchanged.
   */
  private serializeContext(
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    // Lazy serialization: return early if no Error instances present
    if (!this.hasErrorInstances(context)) {
      return context
    }

    const serialized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(context)) {
      if (value instanceof Error) {
        serialized[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...(Object.keys(value).length > 0 && { details: { ...value } }),
        }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // Recursively serialize nested objects
        serialized[key] = this.serializeContext(
          value as Record<string, unknown>,
        )
      } else {
        serialized[key] = value
      }
    }

    return serialized
  }

  /**
   * Check if context contains any Error instances (including nested)
   */
  private hasErrorInstances(obj: Record<string, unknown>): boolean {
    for (const value of Object.values(obj)) {
      if (value instanceof Error) {
        return true
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (this.hasErrorInstances(value as Record<string, unknown>)) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Pretty console output for development
   */
  private logPretty(level: LogLevel, entry: LogEntry): void {
    const color = LOG_LEVEL_COLORS[level]
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const levelName = entry.level.padEnd(5)

    let output = `${color}[${timestamp}] ${levelName}${RESET_COLOR} ${entry.message}`

    if (entry.context) {
      output += `\n  ${JSON.stringify(entry.context, null, 2)
        .split("\n")
        .join("\n  ")}`
    }

    if (entry.error) {
      output += `\n  ${color}Error: ${entry.error.name} - ${entry.error.message}${RESET_COLOR}`
      if (entry.error.stack) {
        output += `\n  ${entry.error.stack
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")}`
      }
    }

    console.log(output)
  }

  /**
   * JSON output for production
   */
  private logJson(entry: LogEntry): void {
    console.log(JSON.stringify(entry))
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context?: Record<string, unknown>): ILogger {
  const level = parseLogLevel(config.LOG_LEVEL)
  return new Logger(level, context)
}

/**
 * Global logger instance
 */
export const logger = createLogger()
