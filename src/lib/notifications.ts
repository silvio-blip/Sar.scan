import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export async function initPushNotifications(userId: string) {
  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.error('Permissão de notificação negada!');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('FCM Token obtido:', token.value);
      
      if (userId) {
        await supabase
          .from('profiles')
          .update({ fcm_token: token.value })
          .eq('id', userId);
      }
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Notificação recebida em foreground:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Ação na notificação (Chamada):', notification);
    });

  } catch (e) {
    console.error('Erro ao inicializar FCM:', e);
  }
}
