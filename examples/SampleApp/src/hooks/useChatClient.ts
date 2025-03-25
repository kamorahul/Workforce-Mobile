import { useEffect, useRef, useState } from 'react';
import { StreamChat, PushProvider } from 'stream-chat';
import { getMessaging, AuthorizationStatus } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { SqliteClient } from 'stream-chat-react-native';
import { USER_TOKENS, USERS } from '../ChatUsers';
import AsyncStore from '../utils/AsyncStore';
import type { LoginConfig, StreamChatGenerics } from '../types';
import { PermissionsAndroid, Platform } from 'react-native';
import { useAuth0, User } from 'react-native-auth0';
import axios from 'axios';

interface WorkforceUser {
  username: string;
}
interface AuthResponse {
  token: string;
  user: WorkforceUser;
}

const messaging = getMessaging();

// Request Push Notification permission from device.
const requestNotificationPermission = async () => {
  const authStatus = await messaging.requestPermission();
  const isEnabled =
    authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
  console.log('Permission Status', { authStatus, isEnabled });
};

const requestAndroidPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

export const useChatClient = () => {
  const [chatClient, setChatClient] = useState<StreamChat<StreamChatGenerics> | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const unsubscribePushListenersRef = useRef<() => void>();

  /**
   * @param config the user login config
   * @returns function to unsubscribe from listeners
   */
  const loginUser = async (config: LoginConfig) => {
    // unsubscribe from previous push listeners
    unsubscribePushListenersRef.current?.();
    const client = StreamChat.getInstance<StreamChatGenerics>(config.apiKey, {
      timeout: 6000,
      // logger: (type, msg) => console.log(type, msg)
    });
    setChatClient(client);

    const user = {
      id: config.userId,
      image: config.userImage,
      name: config.userName,
    };
    console.log('Called ConnectUser');
    const res = await client.connectUser(user, config.userToken);
    console.log(res);
    await AsyncStore.setItem('@stream-rn-sampleapp-login-config', config);

    const permissionAuthStatus = await messaging.hasPermission();
    let isEnabled =
      permissionAuthStatus === AuthorizationStatus.AUTHORIZED ||
      permissionAuthStatus === AuthorizationStatus.PROVISIONAL;

    if (permissionAuthStatus === AuthorizationStatus.DENIED) {
      isEnabled = await requestAndroidPermission();
    }

    if (isEnabled) {
      // Register FCM token with stream chat server.
      // await messaging.set;
      const apnsToken = await messaging.getAPNSToken();
      const firebaseToken = await messaging.getToken();
      console.log('firebase Token', firebaseToken);

      const provider = await AsyncStore.getItem('@stream-rn-sampleapp-push-provider', {
        id: 'firebase',
        name: 'rn-fcm',
      });
      const providerNameOverride = await AsyncStore.getItem<string>(
        `@stream-rn-sampleapp-push-provider-${provider?.id}-override`,
        null,
      );
      const id = provider?.id ?? 'firebase';
      const name =
        providerNameOverride && providerNameOverride?.length > 0
          ? providerNameOverride
          : (provider?.name ?? 'rn-fcm');
      console.log(id);
      const token = id === 'firebase' ? firebaseToken : (apnsToken ?? firebaseToken);
      console.log('add device info ',token, id as PushProvider, client.userID, name);
      try {
        const resD = await client.addDevice(token, id as PushProvider, client.userID, "Firebase");
        console.log(resD);
      } catch (e) {
        console.error(e);
      }
      // Listen to new FCM tokens and register them with stream chat server.
      const unsubscribeTokenRefresh = messaging.onTokenRefresh(async (newFirebaseToken) => {
        const newApnsToken = await messaging.getAPNSToken();
        const newToken = id === 'firebase' ? newFirebaseToken : (newApnsToken ?? firebaseToken);
        await client.addDevice(newToken, id as PushProvider, client.userID, name);
      });
      // show notifications when on foreground
      const unsubscribeForegroundMessageReceive = messaging.onMessage(async (remoteMessage) => {
        const { stream, ...rest } = remoteMessage.data ?? {};
        const data = {
          ...rest,
          ...((stream as unknown as Record<string, string> | undefined) ?? {}), // extract and merge stream object if present
        };
        const channelId = await notifee.createChannel({
          id: 'foreground',
          name: 'Foreground Messages',
        });
        // create the android channel to send the notification to
        // display the notification on foreground
        const notification = remoteMessage.notification ?? {};
        const body = (data.body ?? notification.body) as string;
        const title = (data.title ?? notification.title) as string;

        if (body && title) {
          await notifee.displayNotification({
            android: {
              channelId,
              pressAction: {
                id: 'default',
              },
            },
            body,
            title,
            data,
          });
        }
      });

      unsubscribePushListenersRef.current = () => {
        unsubscribeTokenRefresh();
        unsubscribeForegroundMessageReceive();
      };
    }
    console.log('Setting Chat CLient ... ');
    setChatClient(client);
  };

  const switchUser = async (user: User | null) => {
    setIsConnecting(true);

    await requestNotificationPermission();

    try {
      if (user?.email) {
        const username = user?.email?.replace(/([^a-z0-9_-]+)/gi, "_");
        const response = await axios.post<AuthResponse>(
          'https://api.convoe.ai/join',
          { username },
          { headers: { 'Content-Type': 'application/json' } },
        );

        console.log('response', response);
        await loginUser({
          apiKey: 'p582dvv4pysh',
          userId: username,
          userImage: user.picture,
          userName: user.nickname,
          userToken: response.data.token,
        });

      }
    } catch (e) {
      console.warn(e);
    }
    console.log('setIsConnecting Begin ', isConnecting);
    setIsConnecting(false);
    console.log('setIsConnecting End ', isConnecting);

  };

  const logout = async () => {
    await SqliteClient.resetDB();
    setChatClient(null);
    chatClient?.disconnectUser();
    await AsyncStore.removeItem('@stream-rn-sampleapp-login-config');
  };

  return {
    chatClient,
    isConnecting,
    loginUser,
    logout,
    switchUser,
  };
};
