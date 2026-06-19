import { Channel } from './channel.js';
import { getOrCreateKey } from './keychain.js';

function channel(path: string): Channel {
  const key = getOrCreateKey(path);
  return new Channel(path, key);
}

export { Channel } from './channel.js';
export { Chat } from './chat.js';
export { KnowledgeBase } from './knowledge.js';
export { Schedule } from './schedule.js';
export type * from './types.js';

export default { channel };
