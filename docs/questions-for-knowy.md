# Knowy — Design Questionnaire (with recommendations)

Answer each question below. Strike through or delete questions once resolved. I'll proceed with implementation after you've reviewed/answered.

---

## Section 1 — Channel

### Q1: What does `channel('folder path')` represent on disk?

**Recommendation:** The path is a filesystem directory. Inside it lives a single `knowy.db` (anigodb SQLite file). The channel = a database = a self-contained workspace.

- Option A: **Path is a directory** containing `knowy.db`
- Option B: Path IS the `.db` file directly (user provides path/to/knowy.db)
- Option C: Path is a namespace prefix for collections in a single global DB

**My pick: A** — most intuitive for a "local knowledge base" use case. Also a folder files/ which store all file saved by users.

### Q2: Calling `channel('./x')` twice — same instance or second connection?

**Recommendation:** Return the same cached instance. Maintain an internal `Map<resolvedPath, Channel>`.

### Q3: Multiple channels open at once?

**Recommendation:** Yes. Each is an independent anigodb connection to its own `.db` file. This lets users separate projects.

### Q4: What methods does Channel expose?

**Recommendation:** All entity CRUD (`listPages`, `getNote`, `delete`), factory methods (`knowledge`, `schedule`, `chat`), plus `close()` and perhaps `search(query)`. Yes. need search(query)

---

## Section 2 — User

### Q5: What is a User in knowy's domain?

**Recommendation:** An identity that interacts with the system — yourself, a collaborator, or an AI agent. Used for task assignment and message tagging.

- *Not* a login/authentication concept. Just a name + metadata envelope. Yes the metadata is a free json

### Q6: Is `name` unique?

**Recommendation:** Yes. `name` is the natural key. `getUser('Alice')` looks it up.

### Q7: What goes in `metadata`?

**Recommendation:** Free-form JSON. Consumer decides. Typical uses: email, avatar URL, role, contact info.

### Q8: CRUD for User?

From the pattern:

| Method                                 | Key                   |
| -------------------------------------- | --------------------- |
| `channel.saveUser({ name, metadata })` | auto-ID + name unique |
| `channel.getUser(name)`                | by name               |
| `channel.listUsers()`                  | all                   |
| `channel.deleteUser(name)`             | by name               |

**Recommendation:** Keep `delete` generic (`channel.delete(id)`) but provide delete-by-name convenience. Need to decide: does `delete` understand entity type or is it ID-only?

---

## Section 3 — Page

### Q9: `savePage({ title, md })` — confirmed signature?

**Recommendation:** Yes. `title` for the heading, `md` for the full markdown body.

### Q10: Should Page content be full-text indexed?

**Recommendation:** Yes. just use the createRAGIndex provided by anigodb.

### Q11: Should `getPage` use ID or title?

**Recommendation:** Use ID (as shown). This implies titles are NOT guaranteed unique across pages. Keep a separate `getPageByTitle(title)` or use `listPages({ title })` filter.

### Q12: Should Pages support tags, categories, or folder hierarchies?

**Recommendation:** V1 — no. Just title + md. Add metadata field later if needed.

---

## Section 4 — Note

### Q13: Note vs Page — what's the distinction?

**Recommendation:** techically they are no difference. but in the view of user, page only store md file. note store any text.

### Q14: Should Notes support tags?

**Recommendation:** V1 — no.

### Q15: RAG on Note content?

**Recommendation:** Just use the createRAGIndex from anigodb

---

## Section 5 — Task

### Q16: Valid status values?

**Recommendation:**

```
pending | in_progress | done | cancelled
```

### Q17: `due` format?

**Recommendation:** ISO 8601 string (e.g. `"2026-07-01"` or `"2026-07-01T14:00:00.000Z"`). anigodb serializes Dates to ISO strings anyway.

### Q18: Should `detail` be full-text indexed?

**Recommendation:** Yes. Just use the createRAGIndex from anigodb. also index the title.

### Q19: Can tasks be assigned to a User?

**Recommendation:** Optional `assignee` field referencing user name. Not required in v1 but the data model should allow it.

### Q20: Priority? Tags? Dependencies?

**Recommendation:** V1 — no. Just title, due, status, detail.

### Q21: CRUD for Task?

| Method                            | Key             |
| --------------------------------- | --------------- |
| `channel.saveTask({ ... })`       | auto-ID         |
| `channel.getTask(id)`             | by ID           |
| `channel.listTasks()`             | all             |
| `channel.updateTask(id, changes)` | by ID           |
| `channel.delete(id)`              | by ID (unified) |

---

## Section 6 — File

### Q22: Store file content in DB or reference external file?

**Recommendation:** **Reference only.** Store `{ filename, path, size, mimeType? }`. The actual file stays on the filesystem at `path`.

- If the user later wants to move/rename, knowy just updates metadata.

### Q23: Is `path` absolute or relative?

**Recommendation:** Relative to the channel directory. So `saveFile({ filename: 'notes.txt', path: './docs/notes.txt' })` resolves to `<channel-dir>/docs/notes.txt`.

### Q24: FTS index on file content?

**Recommendation:** no any indexing on file content

### Q25: CRUD for File?

| Method                                 | Key     |
| -------------------------------------- | ------- |
| `channel.saveFile({ filename, path })` | auto-ID |
| `channel.getFile(id)`                  | by ID   |
| `channel.listFiles()`                  | all     |
| `channel.delete(id)`                   | by ID   |

---

## Section 7 — Knowledge Base

### Q26: What is a Knowledge Base semantically?

**Recommendation:** A curated collection of Q&A/wiki articles designed for retrieval. The `answer` field stores a canonical or AI-generated answer. The KB is the primary target for RAG queries.

### Q27: Auto-create RAG index on save?

**Recommendation:** **Yes** — `kb.saveDoc` should auto-index `title` + `content` for hybrid (vector + FTS5) search. That's the whole point of a "knowledge base."

- Creates RAG index lazily on first `saveDoc`.
- Uses anigodb's `createRAGIndex` + `search` under the hood.
  yes. Just use the createRAGIndex from anigodb

### Q28: What is `answer`?

**Recommendation:** An optional short answer/summary. The user writes it or an AI generates it. Makes the KB useful for Q&A — you search and get both the full article AND a concise answer.

### Q29: Multiple KBs per channel?

**Recommendation:** Yes. Each KB name maps to its own collection (e.g. `kb_wiki`, `kb_faq`). This keeps RAG indexes separate.

### Q30: KB CRUD + search?

**Recommendation:**

| Method                                   | Key                 |
| ---------------------------------------- | ------------------- |
| `kb.saveDoc({ title, content, answer })` | auto-ID             |
| `kb.getDoc(id)`                          | by ID               |
| `kb.listDocs()`                          | all                 |
| `kb.updateDoc(id, changes)`              | by ID               |
| `kb.deleteDoc(id)`                       | by ID               |
| `kb.search(query)`                       | hybrid search (RAG) |

### Q31: Should KB expose raw anigodb hybrid search?

**Recommendation:** Yes. `kb.search('my question', { limit: 5 })` returns scored results with `_score`.

---

## Section 8 — Schedule & Event

### Q32: `saveEvent` signature confirmed?

```
{ title, start, end, isAllDay, rrule, description, location }
```

**Recommendation:** Yes. All fields optional except `title`, `start`.

### Q33: What is a Schedule?

**Recommendation:** A named calendar. `channel.schedule('Work')` vs `channel.schedule('Personal')`. Each maps to its own events collection.

### Q34: Recurrence format?

**Recommendation:** `rrule` as an iCalendar RRULE string (e.g. `"FREQ=WEEKLY;BYDAY=MO"`). Knowy stores it but doesn't expand recurrences itself — the consumer does that when querying.

### Q35: Event CRUD?

| Method                                            | Key         |
| ------------------------------------------------- | ----------- |
| `schedule.saveEvent({ ... })`                     | auto-ID     |
| `schedule.getEvent(id)`                           | by ID       |
| `schedule.listEvents()`                           | all         |
| `schedule.updateEvent(id, changes)`               | by ID       |
| `schedule.deleteEvent(id)`                        | by ID       |
| `schedule.queryEvents({ startAfter, endBefore })` | range query |

### Q36: Events linked to other entities?

**Recommendation:** V1 — no. 

---

## Section 9 — Chat & Message

*(New from your updated usage)*

### Q37: What is a Chat?

**Recommendation:** A named/sessioned conversation thread. `channel.chat('session-id')` resumes an existing one. `channel.chat()` with no arg creates a new one with auto-generated ID.

### Q38: `chat.saveMessage({ userId, content, reply, tag })` — confirm?

- `userId` — who sent it (refs User.name)
- `content` — message text
- `reply` — ID of the message being replied to (for threading)
- `tag` — array of userIds who need to see this (mentions)

**Recommendation:** Yes.

### Q39: Should chat support RAG/FTS?

**Recommendation:** Yes. Just use the createRAGIndex from anigodb

### Q40: Chat CRUD?

| Method                      | Key                |
| --------------------------- | ------------------ |
| `chat.saveMessage({ ... })` | auto-ID            |
| `chat.getMessage(id)`       | by ID              |
| `chat.listMessages()`       | all, chronological |
| `chat.deleteMessage(id)`    | by ID              |

Also: `channel.listChats()` to get all chat sessions.

---

## Section 10 — Identifiers

### Q41: ID scheme — anigodb ObjectId or custom?

**Recommendation:** Use anigodb's auto-generated 24-char hex ObjectId. It's free, unique, and timestamp-ordered.

### Q42: Should entities have human-readable slugs?

**Recommendation:** V1 — no. Use IDs internally. Titles/names are display fields, not identifiers (except Note where title IS the key).

### Q43: `getNote` uses title, but `getPage` uses ID — consistent?

**Recommendation:** This is an inconsistency. Two options:

- **A:** All `get*` use ID. Provide `getByTitle` as a separate convenience.
- **B:** Notes are title-keyed, Pages are ID-keyed (current design).

**My pick: A** — always use ID, add filter `listPages({ title })` or `getPageByTitle(title)`.

### Q44: `channel.delete(id)` — unified or per-entity?

From your usage: `channel.delete(taskId)`. The comment says "must use id for delete."

Two approaches:

- **A: Unified** — `channel.delete(id)` searches all collections. Requires globally unique IDs across all entity types within a channel.
- **B: Per-entity** — `channel.deletePage(id)`, `channel.deleteNote(id)`, etc. No ID collision risk.

**My pick: B** — per-entity is safer and clearer. Add convenience methods for each entity type. If you really want unified, we need an entity-type registry or ID prefix scheme. Agree

---

## Section 11 — Storage Architecture

### Q45: One DB per channel, or one-to-many?

**Recommendation:** One `.db` file per channel. The channel directory contains `knowy.db`. All entities for that channel live in that DB with separate collections.

### Q46: Collection mapping?

| knowy concept   | anigodb collection                            |
| --------------- | --------------------------------------------- |
| User            | `users`                                       |
| Page            | `pages`                                       |
| Note            | `notes`                                       |
| Task            | `tasks`                                       |
| File            | `files`                                       |
| KnowledgeBase   | `kb_<slug>` (one per KB)                      |
| Schedule events | `schedule_<slug>` (one per schedule)          |
| Chat sessions   | `chat_<session-id>` (one per chat)            |
| Messages        | *(inside chat_* docs or separate collection)* |

**Recommendation:** Messages stored in the same collection as their chat session doc, or as a `chat_messages` table with a `sessionId` discriminator. The latter is cleaner.

**Revised:**

| concept               | collection                                                     |
| --------------------- | -------------------------------------------------------------- |
| Chat session metadata | `chats` (id, createdAt, updatedAt)                             |
| Messages              | `messages` (sessionId, userId, content, reply, tag, createdAt) |

### Q47: Should there be an entity-type registry?

**Recommendation:** no

---

## Section 12 — RAG / Embeddings Strategy

### Q48: Which entities get auto-RAG-indexed?

**Recommendation:**
| Entity | FTS5 | Vector (RAG) |
|---|---|---|
| Page (`md`) | yes | optional (KB-like use) |
| Note (`content`) | yes | no |
| Task (title+detail) | yes | no |
| File (content) | no | no |
| KB doc (title+content) | yes | **yes** |
| Chat message (`content`) | yes | no |T
| Event (title+description) | yes | no |


Just use the createRAGIndex from anigodb, no separated RAG and FTS5

### Q49: Embedding model config?

**Recommendation:** Use anigodb's default (`onnx-community/Qwen3-Embedding-0.6B-ONNX`). Don't expose model config in v1 — just accept it.

### Q50: Should `kb.search()` be exposed on Channel too?

**Recommendation:** Yes — `channel.search(query)` searches across all FTS-indexed entities in the DB. Delegates to anigodb's `db.search()`.

---

## Section 13 — Lifecycle & Error Handling

### Q51: Channel path doesn't exist?

**Recommendation:** Auto-create the directory and the `.db` file. Silent first-use setup.

### Q52: `channel.close()`?

**Recommendation:** Yes. Calls `db.close()` on the underlying anigodb instance.

### Q53: Multiple processes on same channel?

**Recommendation:** V1 — not supported. Single-process only. anigodb's WAL allows it technically, but knowy doesn't coordinate.

### Q54: Unified delete with ID scope?

If we go per-entity delete (Q44-B):

```ts
channel.deletePage(id)
channel.deleteNote(id)
channel.deleteTask(id)
// etc.
```

But your usage showed `channel.delete(taskId)` — so maybe you want the unified approach (Q44-A). In that case we need IDs to be unique across all collections. Using anigodb's ObjectId already guarantees global uniqueness within a DB.

**Recommendation:** Keep `channel.delete(id)` unified since ObjectIds are globally unique. Knowy searches all collections for the matching ID.

---

## Section 14 — Chat-specific decisions

### Q55: Chat thread — sequential or branching?

**Recommendation:** Sequential (linear). `reply` field creates a logical thread but the list is chronological. No branching conversations in v1.

### Q56: `tag` purpose?

A message's `tag` field is an array of user IDs. It means "this message needs attention from these users." Equivalent to @mentions.

### Q57: Can you delete/update messages?

**Recommendation:** Delete yes. Update — v1 no (chat logs are append-only).

---

## Section 15 — Package Shape

### Q58: Module format?

**Recommendation:** Dual ESM/CJS (like anigodb). `import` and `require`.

### Q59: TypeScript?

**Recommendation:** Yes. Full `.d.ts` shipped. Source in TS compiled to JS.

### Q60: Entry point?

```ts
import knowy from 'knowy';      // ESM
const knowy = require('knowy');  // CJS
```

### Q61: Dependencies?

- `anigodb` (prod)
- TypeScript (dev)
- `@types/node` (dev)

No other runtime deps.

---

## Section 16 — Out of Scope for V1

- Sync/backup/export
- CLI tool
- Web UI
- Real-time collaboration
- Plugin system
- Recurrence expansion (RRULE stored but not computed)
- File content indexing
- Data migration between versions

---

## Summary of all methods (proposed final API)

```ts
// Channel lifecycle
knowy.channel(path: string): Channel
channel.close(): void

// User CRUD
channel.saveUser({ name, metadata }): User
channel.getUser(id: string): User | null
channel.listUsers(): User[]
channel.delete(id: string): void                 // unified delete

// Page CRUD
channel.savePage({ title, md }): Page
channel.getPage(id: string): Page | null
channel.listPages(): Page[]
// delete via channel.delete(id)

// Note CRUD
channel.saveNote({ title, content }): Note
channel.getNote(id: string): Note | null         // id, not title
channel.listNotes(): Note[]

// Task CRUD
channel.saveTask({ title, due, status, detail }): Task
channel.getTask(id: string): Task | null
channel.listTasks(): Task[]
channel.updateTask(id: string, changes): Task    // partial update

// File CRUD
channel.saveFile({ filename, path }): File
channel.getFile(id: string): File | null
channel.listFiles(): File[]

// Knowledge Base
channel.knowledge(name: string): KnowledgeBase
kb.saveDoc({ title, content, answer? }): Article
kb.getDoc(id: string): Article | null
kb.listDocs(): Article[]
kb.search(query: string, opts?): SearchResult[]
kb.deleteDoc(id: string): void

// Schedule
channel.schedule(name: string): Schedule
schedule.saveEvent({ title, start, end?, isAllDay?, rrule?, description?, location? }): Event
schedule.getEvent(id: string): Event | null
schedule.listEvents(): Event[]
schedule.queryEvents({ startAfter?, endBefore? }): Event[]
schedule.deleteEvent(id: string): void

// Chat
channel.chat(sessionId?: string): Chat
chat.saveMessage({ userId, content, reply?, tag? }): Message
chat.getMessage(id: string): Message | null
chat.listMessages(): Message[]
chat.deleteMessage(id: string): void
channel.listChats(): ChatSummary[]

// Cross-entity search
channel.search(query: string, opts?): SearchResult[]
```
