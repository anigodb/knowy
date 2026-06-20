import type { Collection } from 'anigodb';
import type { Channel } from './channel.js';
import type { Event } from './types.js';
import { assertKeys, assertString, normalizeLinks } from './validate.js';
import { generateId } from './id.js';

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
    links?: string | string[];
    files?: string[];
    sourceMessageId?: string;
  }): Event {
    assertKeys(input, ['title', 'start', 'end', 'isAllDay', 'rrule', 'description', 'location', 'links', 'files', 'sourceMessageId'], 'saveEvent');
    assertString(input.title, 'title', 'saveEvent');
    assertString(input.start, 'start', 'saveEvent');
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.channel.resolveRecord(id)) throw new Error(`saveEvent: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('event');
    const ts = new Date().toISOString();
    const doc = { _id: id, title: input.title, start: input.start, end: input.end, isAllDay: input.isAllDay, rrule: input.rrule, description: input.description, location: input.location, links, files: input.files, sourceMessageId: input.sourceMessageId, createdAt: ts, updatedAt: ts };
    this.collection().insertOne(doc);
    const { _id, ...rest } = doc;
    return { id: _id, ...rest } as unknown as Event;
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
    assertKeys(changes, ['title', 'start', 'end', 'isAllDay', 'rrule', 'description', 'location', 'links', 'files', 'sourceMessageId'], 'updateEvent');
    const links = normalizeLinks(changes.links);
    if (links) for (const id of links) {
      if (!this.channel.resolveRecord(id)) throw new Error(`updateEvent: cannot link to nonexistent record "${id}"`);
    }
    const { links: _omitLinks, ...cleanChanges } = changes;
    const ts = new Date().toISOString();
    const coll = this.collection();
    const existing = coll.findOne({ _id: id });
    if (!existing) throw new Error('updateEvent: event not found');
    const doc: Record<string, unknown> = { ...existing, ...cleanChanges, ...(links !== undefined ? { links } : {}), updatedAt: ts };
    delete doc._id;
    coll.findOneAndReplace({ _id: id }, doc as Record<string, unknown>);
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
