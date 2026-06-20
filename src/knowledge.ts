import type { Collection } from 'anigodb';
import type { Channel } from './channel.js';
import type { Article, SearchResult } from './types.js';
import { assertKeys, assertString, normalizeLinks } from './validate.js';
import { generateId } from './id.js';

type Doc = Record<string, unknown>;

export class KnowledgeBase {
  readonly name: string;
  private collectionName: string;
  private channel: Channel;
  private ragCreated = false;

  constructor(name: string, channel: Channel) {
    this.name = name;
    this.channel = channel;
    this.collectionName = 'kb_' + slugify(name);
    this.collection().createIndex({ title: 1 });
  }

  private collection(): Collection<Record<string, unknown>> {
    return this.channel.getCollection(this.collectionName);
  }

  private ensureRAG(): void {
    if (this.ragCreated) return;
    this.ragCreated = true;
    const coll = this.collection();
    coll.createRAGIndex('title');
    coll.createRAGIndex('content');
  }

  saveArticle(input: { title: string; content: string; answer?: string; links?: string | string[]; sourceMessageId?: string }): Article {
    assertKeys(input, ['title', 'content', 'answer', 'links', 'sourceMessageId'], 'saveArticle');
    assertString(input.title, 'title', 'saveArticle');
    assertString(input.content, 'content', 'saveArticle');
    const links = normalizeLinks(input.links);
    if (links) for (const id of links) {
      if (!this.channel.resolveRecord(id)) throw new Error(`saveArticle: cannot link to nonexistent record "${id}"`);
    }
    const id = generateId('article');
    const ts = new Date().toISOString();
    const doc = { _id: id, title: input.title, content: input.content, answer: input.answer, links, sourceMessageId: input.sourceMessageId, createdAt: ts, updatedAt: ts };
    this.collection().insertOne(doc);
    const { _id, ...rest } = doc;
    return { id: _id, ...rest } as unknown as Article;
  }

  getArticle(id: string): Article | null {
    const doc = this.collection().findOne({ _id: id });
    if (!doc) return null;
    const { _id, ...rest } = doc as Doc & { _id: string };
    return { id: _id, ...rest } as unknown as Article;
  }

  listArticles(filter?: Record<string, unknown>): Article[] {
    return (this.collection().find(filter ?? {}) as (Doc & { _id: string })[])
      .map(d => { const { _id, ...rest } = d; return { id: _id, ...rest } as unknown as Article; });
  }

  updateArticle(id: string, changes: Partial<Pick<Article, 'title' | 'content' | 'answer' | 'links'>>): Article {
    assertKeys(changes, ['title', 'content', 'answer', 'links'], 'updateArticle');
    const links = normalizeLinks(changes.links);
    if (links) for (const id of links) {
      if (!this.channel.resolveRecord(id)) throw new Error(`updateArticle: cannot link to nonexistent record "${id}"`);
    }
    const { links: _omitLinks, ...cleanChanges } = changes;
    const ts = new Date().toISOString();
    const coll = this.collection();
    const existing = coll.findOne({ _id: id });
    if (!existing) throw new Error('updateArticle: article not found');
    const doc: Record<string, unknown> = { ...existing, ...cleanChanges, ...(links !== undefined ? { links } : {}), updatedAt: ts };
    delete doc._id;
    coll.findOneAndReplace({ _id: id }, doc as Record<string, unknown>);
    return this.getArticle(id)!;
  }

  deleteArticle(id: string): void {
    this.collection().deleteOne({ _id: id });
  }

  search(query: string, options?: { limit?: number; filter?: Record<string, unknown> }): SearchResult[] {
    this.ensureRAG();
    const rawResults = this.collection().search(query, {
      limit: options?.limit ?? 10,
    }) as Doc[];

    return rawResults.map((r) => {
      const entity = { ...r };
      delete entity._score;
      const id = entity._id as string;
      delete entity._id;
      return {
        collection: this.collectionName,
        entityType: 'Article',
        id,
        title: entity.title as string,
        snippet: entity.content as string,
        score: r._score as number,
        entity: { id, ...entity },
      };
    });
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
