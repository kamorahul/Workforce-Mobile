import React from 'react';

import type { Channel } from 'stream-chat';

import { useChannelPreviewData } from './hooks/useChannelPreviewData';

import {
  ChannelsContextValue,
  useChannelsContext,
} from '../../contexts/channelsContext/ChannelsContext';
import { ChatContextValue, useChatContext } from '../../contexts/chatContext/ChatContext';

import type { DefaultStreamChatGenerics } from '../../types/types';

export type ChannelPreviewProps<
  StreamChatGenerics extends DefaultStreamChatGenerics = DefaultStreamChatGenerics,
> = Partial<Pick<ChatContextValue<StreamChatGenerics>, 'client'>> &
  Partial<Pick<ChannelsContextValue<StreamChatGenerics>, 'Preview' | 'forceUpdate'>> & {
    /**
     * Instance of Channel from stream-chat package.
     */
    channel: Channel<StreamChatGenerics>;
  };

export const ChannelPreview = <
  StreamChatGenerics extends DefaultStreamChatGenerics = DefaultStreamChatGenerics,
>(
  props: ChannelPreviewProps<StreamChatGenerics>,
) => {
  const { channel, client: propClient, forceUpdate: propForceUpdate, Preview: propPreview } = props;

  const { client: contextClient } = useChatContext<StreamChatGenerics>();
  const { Preview: contextPreview } = useChannelsContext<StreamChatGenerics>();

  const client = propClient || contextClient;
  const Preview = propPreview || contextPreview;

  const { latestMessagePreview, muted, unread } = useChannelPreviewData(
    channel,
    client,
    propForceUpdate,
  );

  return (
    <Preview
      channel={channel}
      latestMessagePreview={latestMessagePreview}
      muted={muted}
      unread={unread}
    />
  );
};
