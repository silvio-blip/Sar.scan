import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

export const requestAllPermissions = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Pedir permissão de Câmara e Fotos
    await Camera.requestPermissions().catch(e => console.log('Camera perm error:', e));

    // 2. Pedir permissão de Localização
    await Geolocation.requestPermissions().catch(e => console.log('Location perm error:', e));

    // 3. Pedir permissão de Notificações
    const pushStatus = await PushNotifications.checkPermissions();
    if (pushStatus.receive === 'prompt') {
      await PushNotifications.requestPermissions();
    }
    await PushNotifications.register().catch(e => console.log('Push register error:', e));

    console.log('Todas as permissões nativas solicitadas.');
  } catch (error) {
    console.error('Erro ao solicitar permissões:', error);
  }
};
