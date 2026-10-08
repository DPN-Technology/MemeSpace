export const chatChannels = [
  {id: 'general', title: 'The common room', description: 'Introductions, questions and everyday conversation.', prompt: 'What brought you into MemeSpace today?'},
  {id: 'memes', title: 'Memes & culture', description: 'Formats, references, remixes and the story behind the joke.', prompt: 'Which meme format deserves a better explanation?'},
  {id: 'web3', title: 'Web3 learning', description: 'Make sense of wallets, networks and on-chain research together.', prompt: 'What Web3 term would you like explained in plain language?'},
  {id: 'gaming', title: 'The arcade', description: 'Compare runs, share strategies and plan your next challenge.', prompt: 'Which cabinet are you playing, and what is your strategy?'},
] as const;

export type ChannelId = typeof chatChannels[number]['id'];
export type ChannelStat = {
  id: ChannelId; title: string; description: string; prompt: string;
  messages: number; voices: number; lastActivity: number;
};
export type ChatMessage = {
  id: string; text: string; created_at: number; edited_at: number;
  reply_to: string | null; name: string; likes: number; liked: boolean; mine: boolean;
  replyCount: number; parent: {id: string; name: string; text: string} | null;
};
export type ChatPage = {
  messages: ChatMessage[]; channels: ChannelStat[]; nextCursor: string | null;
  thread: ChatMessage | null; context: ChatMessage | null; signedIn: boolean; readOnly: boolean;
};
