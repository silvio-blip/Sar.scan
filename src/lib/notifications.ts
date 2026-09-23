import { LocalNotifications } from "@capacitor/local-notifications";
import { isInstalledApp } from "./utils";

export async function initAppNotifications() {
  try {
    if (isInstalledApp()) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          await LocalNotifications.requestPermissions();
        }

        const pending = await LocalNotifications.pending();
        if (pending.notifications.length === 0) {
          await LocalNotifications.schedule({
            notifications: [
              {
                title: "💧 Hora de beber água!",
                body: "Mantenha-se hidratado para alcançar sua meta de hoje.",
                id: 101,
                schedule: { every: "hour" },
                smallIcon: "ic_stat_icon_config_sample",
              },
              {
                title: "🥗 Hora da Refeição & Diário",
                body: "Abra o aplicativo para registrar sua refeição e ver sua evolução.",
                id: 102,
                schedule: { on: { hour: 12, minute: 30 } },
                smallIcon: "ic_stat_icon_config_sample",
              },
              {
                title: "🔥 Resumo do Dia",
                body: "Verifique suas calorias e se está próximo ou distante da sua meta.",
                id: 103,
                schedule: { on: { hour: 20, minute: 0 } },
                smallIcon: "ic_stat_icon_config_sample",
              },
            ],
          });
        }
      } catch (locErr) {
        console.warn("[LocalNotifications] Skipped background notification scheduling:", locErr);
      }
    }
  } catch (e) {
    console.warn("Error initializing notifications:", e);
  }
}

/**
 * Envia notificação push nativa se o usuário estiver usando o APK nativo instalado (Android / Capacitor).
 * No navegador, não faz nada silenciosamente.
 */
export async function sendNativePushNotification(title: string, body: string) {
  try {
    if (!isInstalledApp()) return;

    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const reqPerm = await LocalNotifications.requestPermissions();
      if (reqPerm.display !== "granted") return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 900000) + 100000,
          title,
          body,
          schedule: { at: new Date(Date.now() + 200) },
          sound: "default",
          smallIcon: "ic_stat_icon_config_sample",
        },
      ],
    });
    console.log(`[Native Push] Notificação disparada com sucesso: ${title}`);
  } catch (err) {
    console.warn("[Native Push] Erro ao disparar notificação nativa:", err);
  }
}
