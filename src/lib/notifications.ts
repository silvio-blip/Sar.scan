import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase";

export const initNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === "granted") {
      // 1. Criar Canal de Notificação de Alta Prioridade para Chamadas
      await PushNotifications.createChannel({
        id: "incoming_calls",
        name: "Chamadas Recebidas",
        description: "Canal de alta prioridade para alertas de chamadas em tempo real",
        importance: 5, // IMPORTANCE_HIGH (Faz soar o alarme e exibe pop-up no ecrã)
        visibility: 1, // VISIBILITY_PUBLIC (Aparece no ecrã de bloqueio)
        vibration: true,
      });

      await PushNotifications.register();
    }

    // 2. Registar o Token FCM no perfil do utilizador logado no Supabase
    PushNotifications.addListener("registration", async (token) => {
      console.log("Token FCM do dispositivo:", token.value);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ fcm_token: token.value }).eq("id", user.id);
      }
    });

    // 3. Tratar a receção da notificação quando o telemóvel recebe a chamada
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Notificação recebida em background/foreground:", notification);

      // Se for uma chamada recebida, redireciona para o ecrã de atendimento
      if (
        notification.data?.type === "INCOMING_CALL" ||
        notification.data?.channelId === "incoming_calls"
      ) {
        window.location.href = `/chat?room=${notification.data.roomId || ""}`;
      }
    });
  } catch (error) {
    console.error("Erro na configuração de notificações de chamada:", error);
  }
};
