import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import messaging from '@react-native-firebase/messaging';

import App from './App';
import { name as appName } from './app.json';
import notifee from '@notifee/react-native';



enableScreens();

// Background Message Handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message in the background! ', remoteMessage);
  try {
    const channelId = await notifee.createChannel({
      id: 'default1',
      name: 'Default Channel',
      importance: 4,
    });

    const { stream, ...rest } = remoteMessage.data ?? {};
    const data = {
      ...rest,
      ...stream ?? {}, // extract and merge stream object if present
    };
    const notification = remoteMessage.notification ?? {};
    const body = data.body ?? notification.body;
    const title = data.title ?? notification.title;

    console.log(notification, body, title);
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
  } catch (e) {
    console.log(e);
  }
});

AppRegistry.registerComponent(appName, () => App);
