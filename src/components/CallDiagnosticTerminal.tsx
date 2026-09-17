import { useState, useEffect, useRef } from "react";
import {
  Terminal,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Copy,
  Check,
  Send,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Key,
} from "lucide-react";
import { diagnosticLogger, DiagnosticLog } from "@/lib/diagnostic-logger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/utils";
import { toast } from "sonner";

export function CallDiagnosticTerminal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"logs" | "tester">("logs");

  // Tester state
  const [targetUserIdInput, setTargetUserIdInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [myToken, setMyToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = diagnosticLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "logs" && !isMinimized) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen, activeTab, isMinimized]);

  const loadMyFcmToken = async () => {
    if (!user) return;
    setIsLoadingToken(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, fcm_token")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Erro ao buscar seu perfil no Supabase");
        return;
      }
      setMyToken(data?.fcm_token || "(Nenhum fcm_token salvo no seu perfil)");
      diagnosticLogger.addLog(
        data?.fcm_token ? "success" : "warning",
        "SUPABASE",
        `Token do usuário atual (${user.id}): ${data?.fcm_token ? data.fcm_token.slice(0, 20) + "..." : "NENHUM TOKEN ENCONTRADO"}`,
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoadingToken(false);
    }
  };

  const runPushTest = async () => {
    const targetId = targetUserIdInput.trim() || user?.id;
    if (!targetId) {
      toast.error("Insira o ID do utilizador destinatário para testar.");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    diagnosticLogger.addLog(
      "info",
      "PUSH",
      `[TESTE] Disparando notificação de teste para targetUserId: ${targetId}...`,
    );

    try {
      const res = await fetch(getApiUrl("/api/notifications/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: targetId,
          title: "Chamada de Teste (Terminal)",
          body: "Teste de notificação de alta prioridade disparado pelo terminal!",
          data: {
            type: "INCOMING_CALL",
            roomId: "test-room-" + Date.now(),
            callId: "test-room-" + Date.now(),
            callerName: user?.user_metadata?.nome || "Diagnóstico",
            channelId: "incoming_calls",
          },
        }),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        toast.success("Push enviado com sucesso ao FCM!");
        diagnosticLogger.addLog(
          "success",
          "FCM",
          `[TESTE SUCESSO] ${data.diagnosis || "Notificação aceita pelo FCM!"}`,
          data,
        );
      } else {
        toast.warning(data.error || "FCM retornou aviso/erro");
        diagnosticLogger.addLog(
          "error",
          "FCM",
          `[TESTE FALHA] ${data.diagnosis || data.error || "Erro desconhecido"}`,
          data,
        );
      }
    } catch (err: any) {
      const msg = err.message || "Erro de rede";
      setTestResult({ success: false, error: msg });
      toast.error(msg);
      diagnosticLogger.addLog("error", "SYSTEM", `[TESTE EXCEÇÃO] ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  const copyAllLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.category}] [${l.type.toUpperCase()}]: ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Logs copiados!");
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((l) => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return (
      l.message.toLowerCase().includes(term) ||
      l.category.toLowerCase().includes(term) ||
      l.type.toLowerCase().includes(term)
    );
  });

  const getLogBadge = (type: DiagnosticLog["type"]) => {
    switch (type) {
      case "success":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "error":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "warning":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default:
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    }
  };

  if (!isOpen) {
    return (
      <button
        id="fcm-diagnostic-terminal-btn"
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
          loadMyFcmToken();
        }}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-emerald-400 text-xs font-mono shadow-2xl backdrop-blur-md hover:bg-slate-800 hover:border-emerald-400 transition-all group"
        title="Abrir Terminal de Diagnóstico FCM / Chamadas"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Terminal className="size-3.5 group-hover:rotate-12 transition-transform" />
        <span className="font-semibold">Terminal FCM ({logs.length})</span>
      </button>
    );
  }

  return (
    <div
      id="fcm-diagnostic-terminal-window"
      className={`fixed z-50 transition-all duration-200 ${
        isMinimized
          ? "bottom-24 right-4 w-72 h-12"
          : "bottom-6 right-4 sm:right-6 w-[95vw] sm:w-[540px] max-w-full h-[520px] max-h-[85vh]"
      } flex flex-col bg-slate-950/95 border border-emerald-500/40 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden font-mono text-xs text-slate-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-emerald-400" />
          <span className="font-bold text-slate-100">FCM Diagnostic Console</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
            title={isMinimized ? "Expandir" : "Minimizar"}
          >
            {isMinimized ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-rose-900/40 rounded text-slate-400 hover:text-rose-400"
            title="Fechar"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Subheader / Tabs */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/80">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  activeTab === "logs"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                📜 Logs ({filteredLogs.length})
              </button>
              <button
                onClick={() => setActiveTab("tester")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  activeTab === "tester"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                🔍 Testador Push & Token
              </button>
            </div>

            {activeTab === "logs" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-700/60 rounded text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500 w-24 sm:w-32"
                />
                <button
                  onClick={copyAllLogs}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                  title="Copiar logs"
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
                <button
                  onClick={() => diagnosticLogger.clearLogs()}
                  className="p-1 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 rounded"
                  title="Limpar logs"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )}
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-3 bg-slate-950">
            {activeTab === "logs" ? (
              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>Nenhum log registrado ainda.</p>
                    <p className="text-[11px] mt-1 text-slate-600">
                      Clique no botão de chamar ou use a aba &quot;Testador Push&quot; para disparar
                      eventos.
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${getLogBadge(
                            log.type,
                          )}`}
                        >
                          {log.category}
                        </span>
                      </div>
                      <pre className="text-slate-200 text-[11px] whitespace-pre-wrap break-all font-mono leading-relaxed">
                        {log.message}
                      </pre>
                      {log.data && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-emerald-400">
                            Ver detalhes do payload
                          </summary>
                          <pre className="mt-1 p-1.5 bg-slate-950 rounded border border-slate-800 text-[10px] text-emerald-400 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            ) : (
              /* Tester Tab */
              <div className="space-y-4">
                {/* My Token Section */}
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-200">
                      <Smartphone className="size-4 text-emerald-400" />
                      <span>Meu Token FCM no Supabase</span>
                    </div>
                    <button
                      onClick={loadMyFcmToken}
                      disabled={isLoadingToken}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                    >
                      <RefreshCw
                        className={`size-3 ${isLoadingToken ? "animate-spin text-emerald-400" : ""}`}
                      />
                      Atualizar
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-1">
                    User ID: <span className="text-slate-200 font-mono">{user?.id || "N/A"}</span>
                  </p>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono break-all text-emerald-400">
                    {myToken || "Clique em 'Atualizar' para verificar"}
                  </div>
                </div>

                {/* Test Trigger Section */}
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-2">
                    <Send className="size-4 text-emerald-400" />
                    <span>Disparar Notificação de Teste (FCM)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">
                    Insira o ID do utilizador destinatário (ou deixe em branco para testar no seu
                    próprio telemóvel):
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder={user?.id || "ID do destinatário..."}
                      value={targetUserIdInput}
                      onChange={(e) => setTargetUserIdInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={runPushTest}
                      disabled={isTesting}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-1 text-xs shadow-lg shadow-emerald-500/20"
                    >
                      {isTesting ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <Send className="size-3" />
                      )}
                      Testar
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2.5 rounded-lg border ${
                        testResult.success
                          ? "bg-emerald-950/40 border-emerald-500/50"
                          : "bg-rose-950/40 border-rose-500/50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        {testResult.success ? (
                          <>
                            <CheckCircle2 className="size-4 text-emerald-400" />
                            <span className="text-emerald-400">Resposta FCM: Sucesso</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="size-4 text-rose-400" />
                            <span className="text-rose-400">Resposta FCM: Atenção/Erro</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-200 mb-1 leading-relaxed">
                        {testResult.diagnosis || testResult.error || "Processado pelo servidor."}
                      </p>
                      {testResult.maskedTokens && (
                        <p className="text-[10px] text-slate-400">
                          Tokens visados: {testResult.maskedTokens.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Common Diagnostic Guide */}
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertTriangle className="size-4" />
                    <span>Guia Rápido de Resolução:</span>
                  </div>
                  <p>
                    <strong className="text-slate-300">
                      1. O Push dá Sucesso mas o telemóvel não toca:
                    </strong>{" "}
                    Garante que a app no telemóvel tem as permissões de notificação autorizadas e
                    que o ecrã não está com &quot;Não Incomodar&quot; ativo.
                  </p>
                  <p>
                    <strong className="text-slate-300">
                      2. Erro &apos;MismatchSenderId&apos; ou &apos;InvalidRegistration&apos;:
                    </strong>{" "}
                    O `google-services.json` do APK pertence a um projeto Firebase diferente da
                    `FCM_SERVER_KEY` configurada no servidor.
                  </p>
                  <p>
                    <strong className="text-slate-300">3. Erro &apos;NotRegistered&apos;:</strong> A
                    app foi reinstalada. Abre a app no telemóvel para registrar o novo token no
                    Supabase.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
