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
