import type { Collection } from 'anigodb';
import type { Channel } from './channel.js';
import type { Event } from './types.js';

type Doc<T> = Record<string, unknown> & { _id: string };

export class Schedule {
  readonly name: string;
  private collectionName: string;
  private channel: Channel;

  constructor(name: string, channel: Channel) {
    this.name = name;
    this.channel = channel;
    this.collectionName = 'schedule_' + slugify(name);
    const coll = this.collection();
    coll.createIndex({ title: 1 });
    coll.createIndex({ start: 1 });
    coll.createIndex({ end: 1 });
  }

  private collection(): Collection<Record<string, unknown>> {
    return this.channel.getCollection(this.collectionName);
  }

  saveEvent(input: {
    title: string;
    start: string;
    end?: string;
    isAllDay?: boolean;
    rrule?: string;
    description?: string;
    location?: string;
    files?: string[];
    sourceMessageId?: string;
  }): Event {
    const ts = new Date().toISOString();
    const doc = { ...input, createdAt: ts, updatedAt: ts };
    const result = this.collection().insertOne(doc);
    return { id: result.insertedId, ...doc } as unknown as Event;
  }

  getEvent(id: string): Event | null {
    const doc = this.collection().findOne({ _id: id }) as Doc<Event> | null;
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest } as unknown as Event;
  }

  listEvents(filter?: Record<string, unknown>): Event[] {
    const docs = this.collection().find(filter ?? {}) as Doc<Event>[];
    return docs.map((doc) => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as unknown as Event;
    });
  }

  updateEvent(id: string, changes: Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>>): Event {
    const ts = new Date().toISOString();
    this.collection().updateOne({ _id: id }, { $set: { ...changes, updatedAt: ts } });
    return this.getEvent(id)!;
  }

  deleteEvent(id: string): void {
    this.collection().deleteOne({ _id: id });
  }

  queryEvents(range: { startAfter?: string; endBefore?: string }): Event[] {
    const filter: Record<string, unknown> = {};
    if (range.startAfter || range.endBefore) {
      const cond: Record<string, string> = {};
      if (range.startAfter) cond.$gte = range.startAfter;
      if (range.endBefore) cond.$lte = range.endBefore;
      filter.start = cond;
    }
    return this.listEvents(filter);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
