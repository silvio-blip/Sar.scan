import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

export const initNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted') {
      await PushNotifications.createChannel({
        id: 'incoming_calls',
        name: 'Chamadas Recebidas',
        description: 'Alerta de chamadas em tempo real',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      await PushNotifications.register();
    }

    PushNotifications.addListener('registration', async (token) => {
      console.log('Token FCM gerado:', token.value);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ fcm_token: token.value })
          .eq('id', user.id);
      }
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      if (notification.data?.type === 'INCOMING_CALL' || notification.data?.channelId === 'incoming_calls') {
        window.location.href = `/chamada?room=${notification.data.roomId || ''}`;
      }
    });

  } catch (error) {
    console.error('Erro nas notificações:', error);
  }
};
