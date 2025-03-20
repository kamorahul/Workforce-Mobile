import React from 'react';

import type { StreamChat } from 'stream-chat';

import type { LoginConfig, StreamChatGenerics } from '../types';

import { User } from 'react-native-auth0';

type AppContextType = {
  chatClient: StreamChat<StreamChatGenerics> | null;
  loginUser: (config: LoginConfig) => void;
  logout: () => void;
  switchUser: (user?: User | null) => void;
};

export const AppContext = React.createContext({} as AppContextType);

export const useAppContext = () => React.useContext(AppContext);
