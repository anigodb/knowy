import { AnigoDB, type Collection } from 'anigodb';
import { Chat } from './chat.js';
import { KnowledgeBase } from './knowledge.js';
import { Schedule } from './schedule.js';
import type {
  User, Page, Note, Task, FileRecord,
  ChatSummary,
  SearchResult,
} from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Doc = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  users: 'User',
  pages: 'Page',
  notes: 'Note',
  tasks: 'Task',
  files: 'File',
  messages: 'Message',
  chats: 'Chat',
};

const RAG_INDEXES: Record<string, string[]> = {
  pages: ['md'],
  notes: ['content'],
  tasks: ['title', 'detail'],
  messages: ['content'],
};

const ORDINARY_INDEXES: Record<string, string[]> = {
  messages: ['userId', 'reply', 'tag'],
  users: ['name'],
  pages: ['title'],
  notes: ['title'],
  tasks: ['title'],
  files: ['filename'],
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

    for (const name of ['users', 'pages', 'notes', 'tasks', 'files', 'chats', 'messages']) {
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
      } else if (name.startsWith('schedule_')) {
        c.createIndex({ title: 1 });
        c.createIndex({ start: 1 });
        c.createIndex({ end: 1 });
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

  saveUser(input: { name: string; metadata?: Record<string, unknown> }): User {
    const ts = now();
    const { insertedId } = this.coll('users').insertOne({ ...input, createdAt: ts, updatedAt: ts });
    return { id: insertedId, ...input, createdAt: ts, updatedAt: ts } as User;
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

  updateUser(id: string, changes: Partial<Pick<User, 'name' | 'metadata'>>): User {
    this.coll('users').updateOne({ _id: id }, { $set: { ...changes, updatedAt: now() } });
    return this.getUser(id)!;
  }

  deleteUser(id: string): void { this.coll('users').deleteOne({ _id: id }); }

  // ── Page CRUD ──

  savePage(input: { title: string; md: string; files?: string[]; sourceMessageId?: string }): Page {
    const ts = now();
    const { insertedId } = this.coll('pages').insertOne({ ...input, createdAt: ts, updatedAt: ts });
    return { id: insertedId, ...input, createdAt: ts, updatedAt: ts } as Page;
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

  updatePage(id: string, changes: Partial<Pick<Page, 'title' | 'md' | 'files'>>): Page {
    this.coll('pages').updateOne({ _id: id }, { $set: { ...changes, updatedAt: now() } });
    return this.getPage(id)!;
  }

  deletePage(id: string): void { this.coll('pages').deleteOne({ _id: id }); }

  // ── Note CRUD ──

  saveNote(input: { title: string; content: string; files?: string[]; sourceMessageId?: string }): Note {
    const ts = now();
    const { insertedId } = this.coll('notes').insertOne({ ...input, createdAt: ts, updatedAt: ts });
    return { id: insertedId, ...input, createdAt: ts, updatedAt: ts } as Note;
  }

  getNote(id: string): Note | null {
    const doc = this.coll('notes').findOne({ _id: id });
    if (!doc) return null;
    return entityToId<Note>(doc as Doc & { _id: string });
  }

  listNotes(filter?: Record<string, unknown>): Note[] {
    return (this.coll('notes').find(filter ?? {}) as (Doc & { _id: string })[])
      .map(d => entityToId<Note>(d));
  }

  updateNote(id: string, changes: Partial<Pick<Note, 'title' | 'content' | 'files'>>): Note {
    this.coll('notes').updateOne({ _id: id }, { $set: { ...changes, updatedAt: now() } });
    return this.getNote(id)!;
  }

  deleteNote(id: string): void { this.coll('notes').deleteOne({ _id: id }); }

  // ── Task CRUD ──

  saveTask(input: { title: string; due?: string; status?: string; detail?: string; files?: string[]; sourceMessageId?: string }): Task {
    const ts = now();
    const doc = { ...input, status: input.status ?? 'pending', createdAt: ts, updatedAt: ts };
    if (input.detail === undefined) delete (doc as Record<string, unknown>).detail;
    const { insertedId } = this.coll('tasks').insertOne(doc);
    return { id: insertedId, ...doc } as Task;
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
    this.coll('tasks').updateOne({ _id: id }, { $set: { ...changes, updatedAt: now() } });
    return this.getTask(id)!;
  }

  deleteTask(id: string): void { this.coll('tasks').deleteOne({ _id: id }); }

  // ── File CRUD ──

  saveFile(input: { filename: string; path: string; sourceMessageId?: string }): FileRecord {
    const ts = now();
    const filesDir = path.join(path.dirname(this.dbPath), 'files');
    const destPath = path.join(filesDir, input.filename);
    fs.copyFileSync(input.path, destPath);
    const stat = fs.statSync(destPath);
    const doc = {
      filename: input.filename,
      path: input.filename,
      size: stat.size,
      sourceMessageId: input.sourceMessageId,
      createdAt: ts,
      updatedAt: ts,
    };
    const { insertedId } = this.coll('files').insertOne(doc);
    return { id: insertedId, ...doc } as FileRecord;
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

  updateFile(id: string, changes: Partial<Pick<FileRecord, 'filename' | 'path'>>): FileRecord {
    this.coll('files').updateOne({ _id: id }, { $set: { ...changes, updatedAt: now() } });
    return this.getFile(id)!;
  }

  deleteFile(id: string): void { this.coll('files').deleteOne({ _id: id }); }

  // ── KnowledgeBase ──

  knowledge(name: string): KnowledgeBase {
    return new KnowledgeBase(name, this);
  }

  // ── Schedule ──

  schedule(name: string): Schedule {
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
    const { insertedId } = this.coll('chats').insertOne({ title, sessionId: '', createdAt: ts, updatedAt: ts });
    this.coll('chats').updateOne({ _id: insertedId }, { $set: { sessionId: insertedId } });
    const chat = new Chat(insertedId, this);
    this.chatCache.set(insertedId, chat);
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
          snippet: (entity.content ?? entity.md ?? entity.detail ?? '') as string,
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
        snippet: (entity.content ?? entity.md ?? entity.detail ?? '') as string,
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


}


