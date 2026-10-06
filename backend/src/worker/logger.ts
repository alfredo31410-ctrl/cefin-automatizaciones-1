export interface WorkerLogger {
  info(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}

function write(level: "info" | "error", event: string, context?: Record<string, unknown>): void {
  const entry = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...context });
  if (level === "error") console.error(entry);
  else console.info(entry);
}

export const jsonWorkerLogger: WorkerLogger = {
  info: (event, context) => write("info", event, context),
  error: (event, context) => write("error", event, context),
};

export function safeErrorKind(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
