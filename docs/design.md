# Knowy — Design & Specification

## 1. Domain Model

| Entity | Description | Key Fields | Identity |
|---|---|---|---|
| **Channel** | A workspace backed by a single anigodb DB at a directory path | `path` → `<dir>/knowy.db` + `<dir>/files/` | directory path |
| **User** | A person/agent identity | `name`, `metadata` | auto-ID, name is unique key |
| **Page** | A durable, structured markdown document | `title`, `md`, `files?`, `sourceMessageId?` | auto-ID |
| **Note** | A transient, unstructured text snippet | `title`, `content`, `files?`, `sourceMessageId?` | auto-ID |
| **Task** | An action item | `title`, `due?`, `status`, `detail?`, `files?`, `sourceMessageId?` | auto-ID |
| **File** | A reference to a file copied into `files/` | `filename`, `path`, `size`, `sourceMessageId?` | auto-ID |
| **KnowledgeBase** | A named collection of Q&A articles | `name` → collection `kb_<slug>` | name |
| **Article** | A QA/wiki article within a KB | `title`, `content`, `answer?`, `sourceMessageId?` | auto-ID |
| **Schedule** | A named calendar | `name` → collection `schedule_<slug>` | name |
| **Event** | A calendar event | `title`, `start`, `end?`, `isAllDay?`, `rrule?`, `description?`, `location?`, `files?`, `sourceMessageId?` | auto-ID |
| **Chat** | A conversation session | `sessionId`, `title?`, `createdAt`, `updatedAt` | auto-generated or user-provided ID |
| **Message** | A chat message | `userId`, `content`, `reply?`, `tag?`, `sessionId` | auto-ID |

### Common fields on all mutable entities

Every entity record automatically carries:
- `createdAt` — ISO 8601 string, set by Knowy on creation
- `updatedAt` — ISO 8601 string, set by Knowy on creation and every update
- `sourceMessageId?` — optional reference to the Chat Message that created this entity

Consumers never set `createdAt` or `updatedAt` directly.

---

## 2. Storage Architecture

- **One anigodb database per channel.** The `.db` file lives at `<channel-path>/knowy.db`.
- The channel directory also contains a `files/` subdirectory where saved files are copied.
- Knowy is the storage backend for an AI-powered personal assistant. The primary consumer of the API is code written on behalf of AI agents (MCP tools, plugin scripts).

### Collection mapping

| Knowy concept | anigodb collection | Notes |
|---|---|---|
| User | `users` | |
| Page | `pages` | |
| Note | `notes` | |
| Task | `tasks` | |
| File | `files` | |
| KnowledgeBase articles | `kb_<slug>` | One collection per KB. Slug = sanitized name. |
| Schedule events | `schedule_<slug>` | One collection per schedule. Slug = sanitized name. |
| Chat metadata | `chats` | One doc per chat session. |
| Messages | `messages` | All messages across all chats, discriminated by `sessionId`. |

### IDs

- Uses anigodb's auto-generated 24-char hex **ObjectId** for all entities.
- ObjectIds are globally unique within a single anigodb database, so no collision risk across collections.

---

## 3. RAG / Indexing

- All RAG indexing is delegated to **anigodb's `createRAGIndex`**. Knowy does **not** implement its own indexing logic.
- Knowy calls `collection.createRAGIndex('fieldName')` on the relevant collections at the appropriate time (lazy — on first relevant write, or explicit).
- `channel.search(query)` delegates to anigodb's `db.search()` which performs cross-collection hybrid search.
- `kb.search(query)` delegates to the collection's `search()` method.

### Which fields get indexed

| Entity | Fields to RAG-index via `createRAGIndex` |
|---|---|
| Page | `md` |
| Note | `content` |
| Task | `title`, `detail` |
| KB Article | `title`, `content` |
| Chat Message | `content` |
| Event | `title`, `description` |
| File | *(none — no content indexing)* |

### 3.1 Ordinary Indexes

For performance on lookups, sorts, and relationship queries, Knowy creates **ordinary (non-RAG) indexes** on commonly-filtered fields.

Indexes are created eagerly when the channel is opened, before any API calls return.

| Entity | Indexed Fields | Purpose |
|---|---|---|
| Message | `userId` | Filter messages by author |
| Message | `reply` | Lookup replies to a message (`getReplies`) |
| Message | `tag` | Multi-key index for tag-based queries |
| Event | `title` | Sort/lookup by title |
| Event | `start` | Range queries via `queryEvents()` |
| Event | `end` | Range queries via `queryEvents()` |
| Article (KB doc) | `title` | Lookup by title |
| Task | `title` | Lookup by title |
| Note | `title` | Lookup by title |
| Page | `title` | Lookup by title |
| User | `name` | Unique-key lookups |
| File | `filename` | Lookup by filename |

---

## 4. Full API Reference

### 4.1 Channel lifecycle

```ts
import knowy from 'knowy';

const channel = knowy.channel(path: string): Channel
// - Creates directory + knowy.db if not exist
// - Returns cached instance if same path called twice

channel.close(): void
// - Closes the underlying anigodb connection
```

### 4.2 User CRUD

```ts
channel.saveUser({ name: string, metadata?: Record<string, unknown> }): User
channel.getUser(id: string): User | null
channel.listUsers(filter?: { name?: { $regex?: string } }): User[]
channel.updateUser(id: string, changes: Partial<{ name: string, metadata: Record<string, unknown> }>): User
channel.deleteUser(id: string): void    // by ID
```

### 4.3 Page CRUD

```ts
channel.savePage({ title: string, md: string, files?: string[], sourceMessageId?: string }): Page
channel.getPage(id: string): Page | null
channel.listPages(filter?: { title?: { $regex?: string }, createdAt?: { $gte?: string, $lte?: string } }): Page[]
channel.updatePage(id: string, changes: Partial<{ title: string, md: string, files: string[] }>): Page
channel.deletePage(id: string): void    // by ID
```

### 4.4 Note CRUD

```ts
channel.saveNote({ title: string, content: string, files?: string[], sourceMessageId?: string }): Note
channel.getNote(id: string): Note | null
channel.listNotes(filter?: { title?: { $regex?: string }, createdAt?: { $gte?: string, $lte?: string } }): Note[]
channel.updateNote(id: string, changes: Partial<{ title: string, content: string, files: string[] }>): Note
channel.deleteNote(id: string): void    // by ID
```

### 4.5 Task CRUD

```ts
channel.saveTask({ title: string, due?: string, status?: string, detail?: string, files?: string[], sourceMessageId?: string }): Task
channel.getTask(id: string): Task | null
channel.listTasks(filter?: { status?: string, due?: { $gte?: string, $lte?: string }, title?: { $regex?: string } }): Task[]
channel.updateTask(id: string, changes: Partial<Task>): Task
channel.deleteTask(id: string): void
```

Status values: `pending` | `in_progress` | `done` | `cancelled` (default: `pending`). Status transitions are free-form — any status can transition to any other.

### 4.6 File CRUD

```ts
channel.saveFile({ filename: string, path: string, sourceMessageId?: string }): File
channel.getFile(id: string): File | null
channel.listFiles(filter?: { filename?: { $regex?: string } }): File[]
channel.updateFile(id: string, changes: Partial<{ filename: string, path: string }>): File
channel.deleteFile(id: string): void
```

- `path` is relative to channel directory. On save, the source file is copied into `<channel-dir>/files/` using `filename`.
- Size is auto-detected.
- Files can be attached to entities via the `files` field on the parent entity (array of File IDs).

### 4.7 Knowledge Base

```ts
// Get or create a KB by name
const kb: KnowledgeBase = channel.knowledge(name: string)

kb.saveArticle({ title: string, content: string, answer?: string, sourceMessageId?: string }): Article
kb.getArticle(id: string): Article | null
kb.listArticles(filter?: { title?: { $regex?: string } }): Article[]
kb.updateArticle(id: string, changes: Partial<{ title: string, content: string, answer?: string }>): Article
kb.deleteArticle(id: string): void
kb.search(query: string, options?: { limit?: number, filter?: object }): SearchResult[]
```

### 4.8 Schedule

```ts
// Get or create a schedule by name
const schedule: Schedule = channel.schedule(name: string)

schedule.saveEvent({ title: string, start: string, end?: string, isAllDay?: boolean, rrule?: string, description?: string, location?: string, files?: string[], sourceMessageId?: string }): Event
schedule.getEvent(id: string): Event | null
schedule.listEvents(filter?: { title?: { $regex?: string }, start?: { $gte?: string, $lte?: string } }): Event[]
schedule.updateEvent(id: string, changes: Partial<Event>): Event
schedule.deleteEvent(id: string): void
schedule.queryEvents({ startAfter?: string, endBefore?: string }): Event[]
// queryEvents is date-range-only. For title/location filtering, use schedule.listEvents with filters.
```

### 4.9 Chat & Message

```ts
// Create a new chat:
const chat: Chat = channel.chat()
// or with an explicit title:
const chat: Chat = channel.chat({ title: string })
// Resume an existing chat:
const chat: Chat = channel.chat(sessionId: string)

chat.saveMessage({ userId: string, content: string, reply?: string, tag?: string[] }): Message
// - userId references User.id
// - reply references Message.id within the same chat session (cross-chat replies not allowed)
// - tag is an array of User IDs for @-mentions/notifications

chat.getMessage(id: string): Message | null
chat.listMessages({ limit?: number, after?: string }): Message[]
// - Returns messages chronologically after `after` (exclusive, by message ID).
// - Omit `after` to start from the beginning.
// - `limit` defaults to 50. If count < limit, there are no more messages.

chat.deleteMessage(id: string): void
chat.getReplies(messageId: string): Message[]
// - Returns all direct replies (one level) to the given message within this chat.

chat.setTitle(title: string): void
// - Updates the chat's title. Can be called at any time.

// Chat metadata:
chat.title: string
chat.sessionId: string
chat.createdAt: string
chat.updatedAt: string

// List all chat sessions:
channel.listChats(): ChatSummary[]
```

ChatSummary shape:
```ts
interface ChatSummary {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
// Ordered by updatedAt descending (most recent first).
```

Messages are append-only — they can be deleted but not updated after creation.

### 4.10 Cross-entity search

```ts
channel.search(query: string, options?: {
  limit?: number,
  offset?: number,
  collection?: string      // narrow to a specific collection e.g. "tasks", "pages"
}): SearchResult[]
// Searches across all RAG-indexed collections in the channel.
// Delegates to anigodb's db.search().
// Does NOT include files (files have no RAG index).
```

SearchResult shape:
```ts
interface SearchResult {
  collection: string;          // e.g. "pages", "tasks", "notes", "messages", "kb_wiki"
  entityType: string;          // e.g. "Page", "Task", "Article"
  id: string;                  // auto-ID
  title: string;               // display title
  snippet: string;             // text excerpt around the match
  score: number;               // relevance score from hybrid search
  entity: Record<string, unknown>;  // the full entity document
}
```

---

## 5. Key Design Decisions

### 5.1 Delete uses entity-specific methods

Not a single unified `channel.delete(id)`. Each entity has its own delete:

```ts
channel.deletePage(id)
channel.deleteNote(id)
channel.deleteTask(id)
channel.deleteFile(id)
channel.deleteUser(id)
kb.deleteArticle(id)
schedule.deleteEvent(id)
chat.deleteMessage(id)
```

This avoids ambiguity about which collection to target and is self-documenting.

### 5.2 RAG is delegated entirely to anigodb

Knowy never manages embeddings, vector tables, or FTS indexes directly. It calls `collection.createRAGIndex(field)` on the anigodb collection handle. This means:
- The embedding model is configured at the level (passed through to anigodb).
- Knowy does not need to know about ONNX, vector dimensions, or search fusion.
- Upstream improvements to anigodb's RAG (new models, indexing strategies) are inherited automatically.

### 5.3 File content is copied into the channel

`saves` copies the source file into `<channel-dir>/files/`. The database stores only the `filename` and the relative `path`. This keeps the channel directory self-contained and portable.

### 5.4 Recurrence stored, not expanded

Events with `rrule` store the iCalendar RRULE string verbatim. Knowy does not expand recurring events into individual occurrences. Consumers call `schedule.queryEvents()` with a date range and expand recurrences themselves.

### 5.5 Chat messages are append-only

Messages can be deleted but not updated after creation. This preserves conversation history integrity.

### 5.6 Source Message traceability

Any mutable entity (Task, Event, Note, Page, Article, File) can carry an optional `sourceMessageId` referencing the Chat Message that created it. This enables the AI (and future Studio GUI) to answer "what conversation produced this entity?" Multiple entities created from the same message all reference the same message ID.

### 5.7 Timestamps are auto-managed

Every entity record automatically carries `createdAt` and `updatedAt` ISO 8601 strings. Knowy sets these on create and update. Consumers never set them directly. `updatedAt` on Chat is updated whenever a message is added.

### 5.8 Hard delete

All delete operations are hard deletes — the record is immediately and permanently removed from the database. No soft delete, no undo. This keeps the API simple and storage lean. If recovery is needed, the user backs up the entire channel directory.

### 5.9 Filter syntax on list methods

List methods (`listTasks`, `listNotes`, `listMessages`, etc.) accept an optional filter object that is passed through to anigodb's query API. Filters use MongoDB-like comparison operators (`$gte`, `$lte`, `$regex`, `$in`). Common filter fields are backed by ordinary indexes for performance.

### 5.10 `reply` scope is same-chat only

The `reply` field on Message references another message within the same chat session only. Cross-chat replies are not allowed. `getReplies` only returns messages from the same chat.

### 5.11 Chat title is flexible

A chat title can be set at creation (`channel.chat({ title })`), auto-generated from the first message, or updated later via `chat.setTitle()`. This allows the AI to start a chat quickly and name it once context is clear.

### 5.12 No sub-store deletion in V1

It is not possible to delete an entire Schedule, KnowledgeBase, or Chat session in V1. Individual entities within them can be deleted. Empty collections are invisible to consumers (empty result arrays). Dropping entire collections will be added when the Studio GUI provides confirmation workflows.

---

## 6. Out of Scope for V1

- Multi-process channel access coordination
- Data export/import/migration
- CLI tool
- Web/desktop UI (Studio GUI planned for future)
- Real-time collaboration / sync
- Plugin system
- Recurrence expansion
- File content indexing
- Custom embedding models (uses anigodb default)
- Human-readable slugs on entities
- Tags/categories on pages or notes
- Event-to-entity linking
- Compound indexes
- Soft delete / trash / undo
- Sub-store deletion (Schedule/KB/Chat lifecycle)
- Cross-chat message replies

---

## 7. Package Shape

- **Entry:** `import knowy from 'knowy'` (ESM) / `const knowy = require('knowy')` (CJS)
- **Runtime deps:** `anigodb` only
- **Dev deps:** TypeScript, `@types/node`
- **TypeScript:** Full types shipped. Source compiled to JS + `.d.ts`.
- **Build:** TS → `dist/` with both ESM and CJS outputs.
