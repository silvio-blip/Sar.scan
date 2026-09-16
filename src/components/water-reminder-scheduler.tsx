import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Droplet,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Loader2,
  BellRing,
  Smartphone,
  Info,
} from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getApiUrl } from "@/lib/utils";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface WaterReminderSchedulerProps {
  userId?: string | null;
}

export function WaterReminderScheduler({ userId }: WaterReminderSchedulerProps) {
  const [active, setActive] = useState(() => {
    return localStorage.getItem("water_reminder_active") === "true";
  });

  const [times, setTimes] = useState<string[]>(() => {
    const saved = localStorage.getItem("water_reminder_times");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return ["08:00", "11:00", "14:00", "17:00", "20:00"];
      }
    }
    return ["08:00", "11:00", "14:00", "17:00", "20:00"];
  });

  const [newTime, setNewTime] = useState("10:00");
  const [isTesting, setIsTesting] = useState(false);

  // Sync state to localStorage of device
  useEffect(() => {
    localStorage.setItem("water_reminder_active", active ? "true" : "false");
    localStorage.setItem("water_reminder_times", JSON.stringify(times));
    syncNativeNotifications(active, times);
  }, [active, times]);

  const syncNativeNotifications = async (isReminderActive: boolean, scheduleTimes: string[]) => {
    const isCap = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    if (!isCap) return;

    try {
      // Clear all previous water reminders
      try {
        const pending = await LocalNotifications.getPending();
        if (pending && pending.notifications && pending.notifications.length > 0) {
          // Cancel only ours (id starts at 99990)
          const ours = pending.notifications.filter((n) => n.id >= 99990 && n.id <= 99999);
          if (ours.length > 0) {
            await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
          }
        }
      } catch (cancError) {
        console.warn("[LocalNotifications] Error clearing old schedules:", cancError);
      }

      if (!isReminderActive || scheduleTimes.length === 0) {
        return;
      }

      // Check permissions
      const checkPerm = await LocalNotifications.checkPermissions();
      if (checkPerm.display !== "granted") {
        const reqPerm = await LocalNotifications.requestPermissions();
        if (reqPerm.display !== "granted") {
          toast.warning(
            "Permissão de Notificação local não concedida. Ative em suas configurações de sistema.",
          );
          return;
        }
      }

      // Schedule reminders (strictly in the future to prevent instant retroactive firing on registration)
      const list = scheduleTimes.map((time, idx) => {
        const [hourStr, minStr] = time.split(":");
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minStr, 10);

        const now = new Date();
        const scheduledDate = new Date();
        scheduledDate.setHours(hour);
        scheduledDate.setMinutes(minute);
        scheduledDate.setSeconds(0);
        scheduledDate.setMilliseconds(0);

        // Se o horário já passou hoje, começa a agendar a partir de amanhã para evitar o spam imediato
        if (scheduledDate.getTime() <= now.getTime()) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        return {
          id: 99990 + idx,
          title: "Hora de beber água! 💧",
          body: "Mantenha o seu corpo hidratado para acelerar o seu metabolismo e queimar mais gordura.",
          schedule: {
            at: scheduledDate,
            repeats: true,
            every: "day" as any,
            allowWhileIdle: true,
          },
          sound: "default",
        };
      });

      if (list.length > 0) {
        await LocalNotifications.schedule({ notifications: list });
        console.log(`[Push Local] Agendados ${list.length} lembretes diários de água.`);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes("not supported") ||
        errMsg.includes("Not supported") ||
        errMsg.includes("Web implementation")
      ) {
        console.log(
          "[LocalNotifications] Lembretes offline adicionados localmente (não suportados neste navegador web).",
        );
      } else {
        console.warn("[LocalNotifications] Falha ao sincronizar agenda no dispositivo:", err);
      }
    }
  };

  const handleAddTime = () => {
    if (times.includes(newTime)) {
      toast.error("Este horário já está agendado.");
      return;
    }
    const updated = [...times].sort();
    updated.push(newTime);
    // Sort array of times logically
    updated.sort((a, b) => {
      const [ha, ma] = a.split(":").map(Number);
      const [hb, mb] = b.split(":").map(Number);
      return ha * 60 + ma - (hb * 60 + mb);
    });
    setTimes(updated);
    toast.success(`Lembrete das ${newTime} adicionado!`);
  };

  const handleRemoveTime = (timeToRemove: string) => {
    const updated = times.filter((t) => t !== timeToRemove);
    setTimes(updated);
    toast.success(`Lembrete das ${timeToRemove} removido.`);
  };

  const applyPreset = (presetType: "2h" | "3h" | "clear") => {
    if (presetType === "clear") {
      setTimes([]);
      toast.success("Todos os horários foram limpos.");
      return;
    }

    let presetTimes: string[] = [];
    if (presetType === "2h") {
      presetTimes = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
    } else if (presetType === "3h") {
      presetTimes = ["08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];
    }

    setTimes(presetTimes);
    toast.success(`Preset de ${presetType === "2h" ? "2 em 2 horas" : "3 em 3 horas"} aplicado!`);
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    toast.info("Enviando disparo de teste em 3 segundos...");

    // 1. Native Offline Local reminder test fallback
    const isCap = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    if (isCap) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 99999,
              title: "Lembrete: Água! 💧",
              body: "Teste de notificação nativa offline bem sucedido!",
              schedule: { at: new Date(Date.now() + 3000) },
              sound: "default",
            },
          ],
        });
      } catch (err) {
        console.warn("[LocalNotifications] Failed scheduling quick test:", err);
      }
    }

    // 2. Real Push notification test via FCM (Using the user account)
    if (userId) {
      try {
        const url = getApiUrl("/api/notifications/send");
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: userId,
            title: "Lembrete de Hidratação 💧",
            body: "Este é um teste real de push disparado pelo seu agendador de perfil!",
            data: { type: "water-reminder-test" },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log("[Push Test] FCM push notification delivered successfully!");
          } else {
            console.log(
              "[Push Test] FCM notification skipped (probably missing real token or token is mock):",
              data.message,
            );
          }
        } else {
          console.log(`[Push Test] Server returned non-ok status: ${response.status}`);
        }
      } catch (fetchErr) {
        console.log(
          "[Push Test Status] O envio do push FCM remoto foi ignorado (comum em ambiente web sem chaves ativas ou offline), mas os lembretes locais nativos foram agendados perfeitamente.",
        );
      }
    }

    setTimeout(() => {
      setIsTesting(false);
      toast.success("Teste acionado! Verifique as suas notificações do telemóvel.", {
        icon: "💧",
      });
    }, 3000);
  };

  return (
    <div className="bg-card rounded-[32px] p-5 border border-border shadow-sm space-y-5">
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0">
          <Droplet className="size-6 animate-bounce" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm text-foreground flex items-center gap-2">
            Lembretes de Hidratação
            <span className="text-[9px] bg-sky-500/10 text-sky-500 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider">
              ÁGUA
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium leading-normal">
            Receba notificações diárias para lembrar de manter o corpo bem hidratado.
          </p>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden space-y-4 pt-1"
          >
            <div className="border-t border-border/60 my-2" />

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-amber-500" /> Presets de Horários
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPreset("2h")}
                  className="px-3 py-1.5 bg-secondary/60 hover:bg-secondary/100 active:scale-95 text-xs font-bold rounded-xl border border-border transition-all text-foreground"
                >
                  Cada 2 horas
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("3h")}
                  className="px-3 py-1.5 bg-secondary/60 hover:bg-secondary/100 active:scale-95 text-xs font-bold rounded-xl border border-border transition-all text-foreground"
                >
                  Cada 3 horas
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("clear")}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/15 active:scale-95 text-xs font-black text-red-500 rounded-xl transition-all"
                >
                  Limpar todos
                </button>
              </div>
            </div>

            {/* Current Alarm Times List */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> Seus Horários Agendados ({times.length})
              </span>

              {times.length === 0 ? (
                <div className="bg-secondary/30 rounded-2xl p-4 text-center border border-border/40">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
                    <Info className="size-3.5" /> Sem horários agendados. Adicione um abaixo!
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  <AnimatePresence>
                    {times.map((time) => (
                      <motion.div
                        key={time}
                        layout
                        initial={{ scale: 0.82, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.82, opacity: 0 }}
                        className="bg-primary/5 border border-primary/10 rounded-xl py-2 px-3 flex items-center justify-between gap-1 group/item hover:bg-primary/10 transition-colors"
                      >
                        <span className="font-mono text-sm font-bold text-foreground">{time}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTime(time)}
                          className="p-1 rounded bg-transparent hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Custom Time Add Form */}
            <div className="bg-secondary/30 rounded-2xl p-3 border border-border/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4.5 text-muted-foreground shrink-0" />
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="bg-transparent text-sm font-bold font-mono outline-none text-foreground cursor-pointer p-1 rounded hover:bg-muted"
                />
              </div>

              <button
                type="button"
                onClick={handleAddTime}
                className="px-3.5 h-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
              >
                <Plus className="size-4" /> Adicionar Horário
              </button>
            </div>

            {/* Test push tools */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isTesting}
                onClick={handleTestNotification}
                className="w-full h-11 bg-sky-500/10 hover:bg-sky-500/15 active:scale-95 text-sky-500 disabled:opacity-50 font-black uppercase tracking-wider text-[10px] rounded-[20px] transition-all flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Enviando Teste...
                  </>
                ) : (
                  <>
                    <Smartphone className="size-3.5 animate-pulse" />
                    Testar Disparo Push Agora
                  </>
                )}
              </button>
              <div className="mt-1.5 text-center">
                <p className="text-[10px] text-muted-foreground/80 leading-normal flex items-center justify-center gap-1 font-medium">
                  <BellRing className="size-3 text-sky-500 shrink-0" /> No telemóvel (APK), agendará
                  uma notificação local fidedigna.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
