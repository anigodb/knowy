import type { Collection } from 'anigodb';
import type { Channel } from './channel.js';
import type { Message } from './types.js';
import { newTimestamp } from './types.js';
import { assertKeys, assertString, normalizeLinks } from './validate.js';
import { generateId } from './id.js';

type Doc<T> = Record<string, unknown> & { _id: string };

export class Chat {
  readonly sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;

  private channel: Channel;

  constructor(sessionId: string, channel: Channel) {
    this.sessionId = sessionId;
    this.channel = channel;
    const doc = this.messagesColl().findOne({ _id: 'meta_' + sessionId }) as Doc<Record<string, unknown>> | null;
    const chatDoc = this.chatColl().findOne({ sessionId }) as Doc<Record<string, unknown>> | null;
    this.title = (chatDoc?.title as string) ?? '';
    this.createdAt = (chatDoc?.createdAt as string) ?? newTimestamp();
    this.updatedAt = (chatDoc?.updatedAt as string) ?? newTimestamp();
  }

  private messagesColl(): Collection<Record<string, unknown>> {
    return this.channel.getCollection('messages');
  }

  private chatColl(): Collection<Record<string, unknown>> {
    return this.channel.getCollection('chats');
  }

  saveMessage(input: { userId: string; content: string; reply?: string; mention?: string[]; links?: string | string[] }): Message {
    assertKeys(input, ['userId', 'content', 'reply', 'mention', 'links'], 'saveMessage');
    assertString(input.userId, 'userId', 'saveMessage');
    assertString(input.content, 'content', 'saveMessage');
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.channel.resolveRecord(id)) throw new Error(`saveMessage: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('message');
    const ts = newTimestamp();
    const doc = {
      _id: id,
      userId: input.userId,
      content: input.content,
      reply: input.reply,
      mention: input.mention,
      links,
      sessionId: this.sessionId,
      createdAt: ts,
    };
    this.messagesColl().insertOne(doc);
    this.chatColl().updateOne(
      { sessionId: this.sessionId },
      { $set: { updatedAt: ts } }
    );
    this.updatedAt = ts;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest } as unknown as Message;
  }

  getMessage(id: string): Message | null {
    const doc = this.messagesColl().findOne({ _id: id, sessionId: this.sessionId }) as Doc<Message> | null;
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest } as unknown as Message;
  }

  listMessages(options?: { limit?: number; after?: string }): Message[] {
    const filter: Record<string, unknown> = { sessionId: this.sessionId };
    if (options?.after) {
      const afterDoc = this.messagesColl().findOne({ _id: options.after, sessionId: this.sessionId }) as Doc<Record<string, unknown>> | null;
      if (afterDoc) {
        filter._id = { $gt: afterDoc._id };
      }
    }
    const docs = this.messagesColl().find(filter) as Doc<Message>[];
    const limit = options?.limit ?? 50;
    const sliced = docs.slice(0, limit);
    return sliced.map((doc) => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as unknown as Message;
    });
  }

  deleteMessage(id: string): void {
    this.messagesColl().deleteOne({ _id: id, sessionId: this.sessionId });
  }

  getReplies(messageId: string): Message[] {
    const docs = this.messagesColl().find({
      reply: messageId,
      sessionId: this.sessionId,
    }) as Doc<Message>[];
    return docs.map((doc) => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as unknown as Message;
    });
  }

  setTitle(title: string): void {
    assertString(title, 'title', 'setTitle');
    const ts = newTimestamp();
    this.chatColl().updateOne(
      { sessionId: this.sessionId },
      { $set: { title, updatedAt: ts } }
    );
    this.title = title;
    this.updatedAt = ts;
  }
}
