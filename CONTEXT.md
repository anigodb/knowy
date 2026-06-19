# Knowy Domain Glossary

## Primary User

A single human individual managing their personal life and office work. AI agents may appear as secondary User identities, but there are no other human collaborators in the system.

## User

A person/agent identity that interacts with the system. Includes the primary human user and any AI assistants, distinguished by name. Not a login/authentication concept — just a name + metadata envelope.

## Channel

A high-level workspace boundary representing one domain of the user's life (e.g. "Work", "Personal"). Each Channel is backed by its own anigodb database at a directory path. The user typically has 2–3 channels, not dozens.

## Source Message

An optional reference from any mutable entity (Task, Event, Note, Page, Article, File) back to the Chat Message that created it. Enables traceability: "what conversation produced this entity?"

## Page

A durable, structured markdown document — meeting notes, project plan, reference doc. Rendered as markdown. The user browses and re-reads it over time.

## Note

A transient, unstructured piece of text — sticky note, scratchpad, phone number, quick thought. Minimal metadata. The user jots it down and searches for it when needed.

## Article

A knowledge-base document designed primarily for AI retrieval. Has `title`, `content`, and an optional `answer` (concise canonical answer). Organized within a named KnowledgeBase. The AI queries Articles via RAG search to answer user questions.

## KnowledgeBase

A named collection of Articles (e.g. "Company Wiki", "Recipes"). Maps to a dedicated anigodb collection (`kb_<slug>`). Created lazily via `channel.knowledge(name)`.

## Chat

A conversation session between the primary user and an AI agent. Has a title (auto-generated on first message, or set explicitly), tracks its messages. Multiple chats can exist per channel, organized by topic or domain.

## Task

An action item with a title, optional due date, status, and detail text. Status transitions are free-form (no workflow constraints). Primarily created through AI conversation.

## Message

A chat message within a Chat session. Has a `tag` field containing an array of User IDs who are @-mentioned/notified. Designed for future team collaboration — in V1 single-user mode, tags may reference AI agent identities.

## File

A reference to a file stored in `<channel-dir>/files/`. Can be attached to any entity (Note, Page, Task, Event, Message) via an optional `files` field on the parent entity containing an array of File IDs.

## SearchResult

The shape returned by `channel.search()` and `kb.search()`. Contains identifying metadata (`collection`, `entityType`), context (`title`, `snippet`), a relevance `score`, and the full entity document (`entity`). Designed so the AI consumer can present results with enough context without fetching each entity separately.

## Timestamps

Every entity record automatically carries `createdAt` and `updatedAt` ISO 8601 strings, set by Knowy on create and update. Consumers never set these directly.
