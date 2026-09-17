export interface DiagnosticLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
  category: "CALL" | "PUSH" | "FCM" | "SUPABASE" | "NATIVE" | "SYSTEM";
  message: string;
  data?: any;
}

type LogListener = (logs: DiagnosticLog[]) => void;

class DiagnosticLogger {
  private logs: DiagnosticLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 150;

  constructor() {
    // Interceptar chamadas importantes
    if (typeof window !== "undefined") {
      const originalConsoleLog = console.log;
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;

      console.log = (...args: any[]) => {
        originalConsoleLog.apply(console, args);
        this.processConsoleArgs("info", args);
      };

      console.warn = (...args: any[]) => {
        originalConsoleWarn.apply(console, args);
        this.processConsoleArgs("warning", args);
      };

      console.error = (...args: any[]) => {
        originalConsoleError.apply(console, args);
        this.processConsoleArgs("error", args);
      };
    }
  }

  private processConsoleArgs(defaultType: "info" | "warning" | "error", args: any[]) {
    if (!args || args.length === 0) return;
    const firstStr = typeof args[0] === "string" ? args[0] : "";

    if (
      firstStr.includes("[CALL_DIAGNOSTIC]") ||
      firstStr.includes("[Push") ||
      firstStr.includes("[Call]") ||
      firstStr.includes("[FCM") ||
      firstStr.includes("FCM Token")
    ) {
      let cat: DiagnosticLog["category"] = "SYSTEM";
      if (firstStr.includes("CALL_DIAGNOSTIC") || firstStr.includes("[Call]")) cat = "CALL";
      else if (firstStr.includes("[Push") || firstStr.includes("Push")) cat = "PUSH";
      else if (firstStr.includes("FCM")) cat = "FCM";

      let logType = defaultType;
      if (firstStr.includes("SUCESSO") || firstStr.includes("sucesso")) logType = "success";
      if (firstStr.includes("ERRO") || firstStr.includes("FALHA") || firstStr.includes("CRÍTICO"))
        logType = "error";

      const cleanMessage = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)))
        .join(" ");

      this.addLog(logType, cat, cleanMessage, args.length > 1 ? args[1] : undefined);
    }
  }

  public addLog(
    type: DiagnosticLog["type"],
    category: DiagnosticLog["category"],
    message: string,
    data?: any,
  ) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`;

    const newLog: DiagnosticLog = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      type,
      category,
      message,
      data,
    };

    this.logs = [newLog, ...this.logs.slice(0, this.maxLogs - 1)];
    this.notify();
  }

  public getLogs(): DiagnosticLog[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentLogs = this.getLogs();
    this.listeners.forEach((listener) => {
      try {
        listener(currentLogs);
      } catch (err) {
        console.error("Erro no listener de diagnóstico:", err);
      }
    });
  }
}

export const diagnosticLogger = new DiagnosticLogger();
