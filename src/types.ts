export interface User {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  title: string;
  md: string;
  files?: string[];
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  files?: string[];
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  due?: string;
  status: string;
  detail?: string;
  files?: string[];
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileRecord {
  id: string;
  filename: string;
  path: string;
  size: number;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  answer?: string;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  title: string;
  start: string;
  end?: string;
  isAllDay?: boolean;
  rrule?: string;
  description?: string;
  location?: string;
  files?: string[];
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSummary {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMeta {
  _id: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  reply?: string;
  tag?: string[];
  sessionId: string;
  createdAt: string;
}

export interface SearchResult {
  collection: string;
  entityType: string;
  id: string;
  title: string;
  snippet: string;
  score: number;
  entity: Record<string, unknown>;
}

export function newTimestamp(): string {
  return new Date().toISOString();
}
