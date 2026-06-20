import { AnigoDB, type Collection } from 'anigodb';
import { Chat } from './chat.js';
import { KnowledgeBase } from './knowledge.js';
import { Schedule } from './schedule.js';
import type {
  User, Page, Task, FileRecord,
  ChatSummary,
  SearchResult,
} from './types.js';
import { assertKeys, assertString, normalizeLinks } from './validate.js';
import { generateId } from './id.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Doc = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  users: 'User',
  pages: 'Page',
  tasks: 'Task',
  files: 'File',
  messages: 'Message',
  chats: 'Chat',
};

const RAG_INDEXES: Record<string, string[]> = {
  pages: ['content'],
  tasks: ['title', 'detail'],
  messages: ['content'],
};

const ORDINARY_INDEXES: Record<string, string[]> = {
  messages: ['userId', 'reply', 'mention', 'links'],
  users: ['name', 'links'],
  pages: ['title', 'links'],
  tasks: ['title', 'links'],
  files: ['filename', 'links'],
};

function entityToId<T>(doc: Doc): T & { id: string } {
  const { _id, ...rest } = doc as Doc & { _id: string };
  return { id: _id, ...rest } as T & { id: string };
}

export class Channel {
  private db: AnigoDB;
  private dbPath: string;
  private collections: Map<string, Collection<Record<string, unknown>>> = new Map();
  private chatCache: Map<string, Chat> = new Map();
  private ragCreated: Set<string> = new Set();

  constructor(dir: string, key?: string) {
    const filesDir = path.join(dir, 'files');
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(filesDir, { recursive: true });

    this.dbPath = path.join(dir, 'knowy.db');
    this.db = AnigoDB.connect(key ? { path: this.dbPath, key } : { path: this.dbPath });

    for (const name of ['users', 'pages', 'tasks', 'files', 'chats', 'messages']) {
      this.collections.set(name, this.db.collection(name));
    }

    for (const [coll, fields] of Object.entries(ORDINARY_INDEXES)) {
      const c = this.collections.get(coll);
      if (c) for (const field of fields) c.createIndex({ [field]: 1 });
    }
  }

  close(): void { this.db.close(); }

  private coll(name: string): Collection<Record<string, unknown>> {
    let c = this.collections.get(name);
    if (!c) {
      c = this.db.collection(name);
      this.collections.set(name, c);
      if (name.startsWith('kb_')) {
        c.createIndex({ title: 1 });
        c.createIndex({ links: 1 });
      } else if (name.startsWith('schedule_')) {
        c.createIndex({ title: 1 });
        c.createIndex({ start: 1 });
        c.createIndex({ end: 1 });
        c.createIndex({ links: 1 });
      }
    }
    return c;
  }

  private ensureRAG(collection: string): void {
    const indexes = RAG_INDEXES[collection];
    if (!indexes) return;
    const key = collection;
    if (this.ragCreated.has(key)) return;
    this.ragCreated.add(key);
    const c = this.coll(collection);
    for (const field of indexes) c.createRAGIndex(field);
  }

  // ── User CRUD ──

  saveUser(input: { name: string; metadata?: Record<string, unknown>; links?: string | string[] }): User {
    assertKeys(input, ['name', 'metadata', 'links'], 'saveUser');
    assertString(input.name, 'name', 'saveUser');
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`saveUser: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('user');
    const ts = now();
    const doc = { _id: id, name: input.name, metadata: input.metadata, links, createdAt: ts, updatedAt: ts };
    this.coll('users').insertOne(doc);
    return entityToId<User>(doc as Doc & { _id: string });
  }

  getUser(id: string): User | null {
    const doc = this.coll('users').findOne({ _id: id });
    if (!doc) return null;
    return entityToId<User>(doc as Doc & { _id: string });
  }

  listUsers(filter?: Record<string, unknown>): User[] {
    return (this.coll('users').find(filter ?? {}) as (Doc & { _id: string })[])
      .map(d => entityToId<User>(d));
  }

  updateUser(id: string, changes: Partial<Pick<User, 'name' | 'metadata' | 'links'>>): User {
    assertKeys(changes, ['name', 'metadata', 'links'], 'updateUser');
    const links = normalizeLinks(changes.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`updateUser: cannot link to nonexistent record "${id}"`);
    }
    const { links: _omitLinks, ...cleanChanges } = changes;
    this.updateDoc('users', id, { ...cleanChanges, ...(links !== undefined ? { links } : {}) });
    return this.getUser(id)!;
  }

  deleteUser(id: string): void { this.coll('users').deleteOne({ _id: id }); }

  // ── Page CRUD ──

  savePage(input: { title: string; content: string; type?: 'md' | 'html' | 'text' | 'json' | 'xml'; links?: string | string[]; files?: string[]; sourceMessageId?: string }): Page {
    const ALLOWED_KEYS = new Set(['title', 'content', 'type', 'links', 'files', 'sourceMessageId']);
    for (const key of Object.keys(input)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new Error(`savePage: unrecognized field "${key}". Did you mean "content"?`);
      }
    }
    if (typeof input.content !== 'string' || input.content.length === 0) {
      throw new Error('savePage: "content" is required and must be a non-empty string');
    }
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`savePage: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('page');
    const ts = now();
    const doc = { _id: id, title: input.title, content: input.content, type: input.type ?? 'md', links, files: input.files, sourceMessageId: input.sourceMessageId, createdAt: ts, updatedAt: ts };
    this.coll('pages').insertOne(doc);
    return entityToId<Page>(doc as Doc & { _id: string });
  }

  getPage(id: string): Page | null {
    const doc = this.coll('pages').findOne({ _id: id });
    if (!doc) return null;
    return entityToId<Page>(doc as Doc & { _id: string });
  }

  listPages(filter?: Record<string, unknown>): Page[] {
    return (this.coll('pages').find(filter ?? {}) as (Doc & { _id: string })[])
      .map(d => entityToId<Page>(d));
  }

  updatePage(id: string, changes: Partial<Pick<Page, 'title' | 'content' | 'type' | 'links' | 'files'>>): Page {
    assertKeys(changes, ['title', 'content', 'type', 'links', 'files'], 'updatePage');
    const links = normalizeLinks(changes.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`updatePage: cannot link to nonexistent record "${id}"`);
    }
    const { links: _omitLinks, ...cleanChanges } = changes;
    this.updateDoc('pages', id, { ...cleanChanges, ...(links !== undefined ? { links } : {}) });
    return this.getPage(id)!;
  }

  deletePage(id: string): void { this.coll('pages').deleteOne({ _id: id }); }

  // ── Task CRUD ──

  saveTask(input: { title: string; due?: string; status?: string; detail?: string; links?: string | string[]; files?: string[]; sourceMessageId?: string }): Task {
    assertKeys(input, ['title', 'due', 'status', 'detail', 'links', 'files', 'sourceMessageId'], 'saveTask');
    assertString(input.title, 'title', 'saveTask');
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`saveTask: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('task');
    const ts = now();
    const doc = { _id: id, title: input.title, due: input.due, status: input.status ?? 'pending', detail: input.detail, links, files: input.files, sourceMessageId: input.sourceMessageId, createdAt: ts, updatedAt: ts };
    if (input.detail === undefined) delete (doc as Record<string, unknown>).detail;
    this.coll('tasks').insertOne(doc);
    return entityToId<Task>(doc as Doc & { _id: string });
  }

  getTask(id: string): Task | null {
    const doc = this.coll('tasks').findOne({ _id: id });
    if (!doc) return null;
    return entityToId<Task>(doc as Doc & { _id: string });
  }

  listTasks(filter?: Record<string, unknown>): Task[] {
    return (this.coll('tasks').find(filter ?? {}) as (Doc & { _id: string })[])
      .map(d => entityToId<Task>(d));
  }

  updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task {
    assertKeys(changes, ['title', 'due', 'status', 'detail', 'links', 'files', 'sourceMessageId'], 'updateTask');
    const links = normalizeLinks(changes.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`updateTask: cannot link to nonexistent record "${id}"`);
    }
    const { links: _omitLinks, ...cleanChanges } = changes;
    this.updateDoc('tasks', id, { ...cleanChanges, ...(links !== undefined ? { links } : {}) });
    return this.getTask(id)!;
  }

  deleteTask(id: string): void { this.coll('tasks').deleteOne({ _id: id }); }

  // ── File CRUD ──

  saveFile(input: { filename: string; path: string; links?: string | string[]; sourceMessageId?: string }): FileRecord {
    assertKeys(input, ['filename', 'path', 'links', 'sourceMessageId'], 'saveFile');
    assertString(input.filename, 'filename', 'saveFile');
    assertString(input.path, 'path', 'saveFile');
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`saveFile: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('file');
    const ts = now();
    const filesDir = path.join(path.dirname(this.dbPath), 'files');
    const destPath = path.join(filesDir, input.filename);
    fs.copyFileSync(input.path, destPath);
    const stat = fs.statSync(destPath);
    const doc = {
      _id: id,
      filename: input.filename,
      path: input.filename,
      size: stat.size,
      links,
      sourceMessageId: input.sourceMessageId,
      createdAt: ts,
      updatedAt: ts,
    };
    this.coll('files').insertOne(doc);
    return entityToId<FileRecord>(doc as Doc & { _id: string });
  }

  getFile(id: string): FileRecord | null {
    const doc = this.coll('files').findOne({ _id: id });
    if (!doc) return null;
    return entityToId<FileRecord>(doc as Doc & { _id: string });
  }

  listFiles(filter?: Record<string, unknown>): FileRecord[] {
    return (this.coll('files').find(filter ?? {}) as (Doc & { _id: string })[])
      .map(d => entityToId<FileRecord>(d));
  }

  updateFile(id: string, changes: Partial<Pick<FileRecord, 'filename' | 'path' | 'links'>>): FileRecord {
    assertKeys(changes, ['filename', 'path', 'links'], 'updateFile');
    const links = normalizeLinks(changes.links);
    if (links) for (const id of links) {
      if (!this.resolveRecord(id)) throw new Error(`updateFile: cannot link to nonexistent record "${id}"`);
    }
    const { links: _omitLinks, ...cleanChanges } = changes;
    this.updateDoc('files', id, { ...cleanChanges, ...(links !== undefined ? { links } : {}) });
    return this.getFile(id)!;
  }

  deleteFile(id: string): void { this.coll('files').deleteOne({ _id: id }); }

  // ── KnowledgeBase ──

  knowledge(name: string): KnowledgeBase {
    assertString(name, 'name', 'knowledge');
    return new KnowledgeBase(name, this);
  }

  schedule(name: string): Schedule {
    assertString(name, 'name', 'schedule');
    return new Schedule(name, this);
  }

  // ── Chat ──

  chat(): Chat;
  chat(options: { title: string }): Chat;
  chat(sessionId: string): Chat;
  chat(arg?: string | { title: string }): Chat {
    if (typeof arg === 'string') {
      const cached = this.chatCache.get(arg);
      if (cached) return cached;
      const doc = this.coll('chats').findOne({ sessionId: arg });
      if (!doc) throw new Error(`Chat session not found: ${arg}`);
      const chat = new Chat(arg, this);
      this.chatCache.set(arg, chat);
      return chat;
    }
    const ts = now();
    let title = '';
    if (arg) title = arg.title;
    const id = generateId('chat');
    this.coll('chats').insertOne({ _id: id, title, sessionId: id, createdAt: ts, updatedAt: ts });
    const chat = new Chat(id, this);
    this.chatCache.set(id, chat);
    return chat;
  }

  listChats(): ChatSummary[] {
    const docs = this.coll('chats').find({}) as (Doc & { _id: string })[];
    const messages = this.coll('messages');
    return docs
      .map(d => ({
        sessionId: d.sessionId as string,
        title: (d.title ?? '') as string,
        createdAt: d.createdAt as string,
        updatedAt: d.updatedAt as string,
        messageCount: (messages.find({ sessionId: d.sessionId }) as Doc[]).length,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
  }

  // ── Search ──

  search(query: string, options?: { limit?: number; collection?: string }): SearchResult[] {
    for (const coll of Object.keys(RAG_INDEXES)) this.ensureRAG(coll);

    if (options?.collection) {
      const coll = this.coll(options.collection);
      this.ensureRAG(options.collection);
      const results = coll.search(query, { limit: options.limit ?? 10 }) as Doc[];
      return results.map(r => {
        const id = r._id as string;
        const entity = { ...r };
        delete entity._score;
        delete entity._collection;
        return {
          collection: options.collection!,
          entityType: ENTITY_TYPE_MAP[options.collection!] ?? 'Article',
          id,
          title: (entity.title ?? entity.name ?? '') as string,
          snippet: (entity.content ?? entity.detail ?? '') as string,
          score: r._score as number,
          entity: { id, ...entity },
        };
      });
    }

    const rawResults = this.db.search(query, { limit: options?.limit ?? 10 }) as Doc[];
    return rawResults.map(r => {
      const collName = r._collection as string;
      const entity = { ...r };
      delete entity._collection;
      delete entity._score;
      const id = entity._id as string;
      delete entity._id;
      return {
        collection: collName,
        entityType: ENTITY_TYPE_MAP[collName] ?? 'Article',
        id,
        title: (entity.title ?? entity.name ?? '') as string,
        snippet: (entity.content ?? entity.detail ?? '') as string,
        score: r._score as number,
        entity: { id, ...entity },
      };
    });
  }

  // Internal helpers

  getCollection(name: string): Collection<Record<string, unknown>> {
    return this.coll(name);
  }

  getDb(): AnigoDB {
    return this.db;
  }

  resolveRecord(id: string): boolean {
    for (const [, coll] of this.collections) {
      if (coll.findOne({ _id: id })) return true;
    }
    return false;
  }

  private updateDoc(collection: string, id: string, changes: Record<string, unknown>): void {
    const c = this.coll(collection);
    const existing = c.findOne({ _id: id });
    if (!existing) return;
    const doc: Record<string, unknown> = { ...existing, ...changes, updatedAt: now() };
    delete doc._id;
    c.findOneAndReplace({ _id: id }, doc as Record<string, unknown>);
  }


}