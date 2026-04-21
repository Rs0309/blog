type LogLevel = "INFO" | "WARN" | "ERROR";

function write(level: LogLevel, message: string, details?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(details ?? {})
  };

  const serialized = JSON.stringify(payload);
  if (level === "ERROR") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  error: (message: string, details?: Record<string, unknown>) => write("ERROR", message, details),
  info: (message: string, details?: Record<string, unknown>) => write("INFO", message, details),
  warn: (message: string, details?: Record<string, unknown>) => write("WARN", message, details)
};
