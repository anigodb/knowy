# PRD: Ordinary Indexes & `getReplies`

## Problem Statement

The Knowy design specifies a rich domain model with multiple entity types (User, Page, Note, Task, File, Article, Event, Message) operating against a single anigodb database per channel. As usage grows, unfiltered collection scans for common lookup patterns — fetching messages by author, finding replies, filtering events by date, looking up entities by title/name — will become a performance bottleneck. The chat API also lacks a way to retrieve threaded replies to a given message, which is needed for conversation reconstruction.

## Solution

1. **Ordinary (non-RAG) indexes** — a set of single-field `createIndex` calls on commonly-filtered fields across all entity collections, eagerly created when a channel is opened.
2. **`chat.getReplies(messageId)`** — a new method on the Chat object that returns all direct replies to a given message by matching the `reply` field.

## User Stories

1. As a developer integrating Knowy, I want `Message` collection indexed on `userId` so that filtering messages by author is a fast index lookup rather than a full collection scan.
2. As a developer, I want `Message` collection indexed on `reply` so that `getReplies()` and any future reply-tree queries are performant.
3. As a developer, I want `Message` collection indexed on `tag` so that tag/mention-based queries use an index (multi-key for array values).
4. As a developer, I want `Event` collection indexed on `title` and `start` so that `queryEvents()` range filters and title lookups are efficient.
5. As a developer, I want `Article` (KB doc), `Task`, `Note`, `Page`, `User`, and `File` collections indexed on their natural lookup fields (`title`, `name`, `filename`) so that get/list/filter operations scale.
6. As a developer, I want indexes created eagerly when the channel opens rather than lazily, so there is no cold-start performance penalty on first query.
7. As a developer, I want separate single-field indexes rather than compound indexes so that each field can be queried independently without requiring all fields in the filter.
8. As a chat user, I want `chat.getReplies(messageId)` to return all messages that directly reply to a given message so that I can reconstruct conversation threads.
9. As a developer, I want `getReplies` to return only direct (one-level) replies rather than walking a recursive reply tree, so that the implementation is simple, predictable, and O(1) with the index.
10. As a developer, I want `getReplies` to be well-named (`getReplies` not `getReplys`) so that the API is grammatically correct and self-documenting.

## Implementation Decisions

- **Index type**: Ordinary indexes via anigodb's `collection.createIndex(field)` — not `createRAGIndex`. RAG indexes are for vector+FTS5 hybrid search; ordinary indexes are for equality and range lookups.
- **Creation timing**: Eager — all ordinary indexes are created inside `channel.open()` (or equivalent initialization path) before any public API method returns. This avoids lazy cold-start overhead.
- **Index granularity**: Single-field indexes only. Compound indexes are unnecessary since no query pattern filters on multiple indexed fields simultaneously.
- **getReplies semantics**: Direct replies only. `getReplies(id)` returns documents from `messages` where `reply === id`. No recursive tree walk.
- **API naming**: `getReplies` (not `getReplys`), matching standard English pluralization.
- **Design doc placement**: Ordinary indexes documented in a new §3.1 subsection under the existing RAG/Indexing section, keeping the two index types visually distinct.
- **Complete index list**:

| Collection | Field | Purpose |
|---|---|---|
| messages | `userId` | Filter by author |
| messages | `reply` | Reply-lookup for threading |
| messages | `tag` | Tag/mention queries (multi-key index) |
| events (`schedule_*`) | `title` | Title-based lookup |
| events (`schedule_*`) | `start` | Range query in `queryEvents()` |
| events (`schedule_*`) | `end` | Range query in `queryEvents()` |
| articles (`kb_*`) | `title` | Title-based lookup |
| tasks | `title` | Title-based lookup |
| notes | `title` | Title-based lookup |
| pages | `title` | Title-based lookup |
| users | `name` | Name-based lookup |
| files | `filename` | Filename-based lookup |

## Testing Decisions

### What makes a good test

- Test external behavior, not implementation details.
- Test through the public API (Channel/Chat methods) rather than reaching into database internals.
- Prefer integration tests that exercise real anigodb to verify index creation and query correctness.

### Seams

1. **Channel open integration test** — Open a channel, verify that ordinary indexes exist on the expected collections by inserting data and querying on indexed fields.
2. **Chat unit test** — Instantiate Chat with a mocked message collection; call `getReplies(id)` and assert the correct message documents are returned and that non-reply messages and replies to other messages are excluded.
3. **Chat integration test** — Open a channel, create a chat, save several messages with various `reply` values, call `getReplies(id)`, and verify the round-trip produces the correct results from a real anigodb database.

No existing test harness or framework exists in the repo yet — these seams will be the foundation.

## Out of Scope

- Compound or multi-field indexes
- Recursive/tree-walk reply resolution (e.g., getting all descendants of a message)
- Lazy index creation
- Cross-collection indexes
- Index lifecycle management (rebuild, drop, reindex)
- Full-text search indexes on title/name fields (those are covered by RAG indexing in §3 of the design)
- Performance benchmarks or query-plan analysis

## Further Notes

- The index list and `getReplies` specification have already been merged into `docs/design.md` (see §3.1 and §4.9).
- Index creation uses anigodb's native `createIndex` method — no custom indexing logic in Knowy. This is consistent with the existing design principle that "RAG/delegated entirely to anigodb" (Design Decision 5.2), extended here to ordinary indexes.
- The `tag` field on `Message` is `string[]` (an array), so the anigodb index should be a multi-key index that automatically indexes each array element.
