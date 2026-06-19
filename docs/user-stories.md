# Knowy — User Stories & Use Cases

> A single human managing their personal life and office work, with AI agents as assistants.
> Knowy is the persistent storage backend that gives the AI memory.

---

## Story 1: Morning Briefing

### Tagline

"Alex starts every day by asking his AI what's happening — and gets a unified answer without opening five different apps."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| Open calendar app to see today's meetings | One question: "What's today?" |
| Open task app to see pending items | AI queries both Schedule + Tasks in one call |
| Cross-reference manually: "is that meeting prepping for this task?" | AI synthesizes connections automatically |
| 5 minutes of context-switching every morning | 5 seconds of conversation |

### The Flow

```
┌─────────────┐     "What's on my plate today?"
│   Alex      │ ──────────────────────────────────► ┌──────────┐
│  (Human)    │                                       │  AI      │
│             │◄──────────────────────────────────────│  Agent   │
└─────────────┘   "You have a 10AM standup,            └────┬─────┘
                   2PM design review, pay rent               │
                   due today, 2 other pending       ┌────────┴────────┐
                   tasks..."                        │   Knowy API    │
                                                    └──┬──────────┬──┘
                                                       │          │
                                              ┌────────┴──┐ ┌───┴────────┐
                                              │  schedule  │ │   tasks    │
                                              │ .queryEvents│ │ .listTasks │
                                              │ (today)    │ │ (pending)  │
                                              └────────────┘ └────────────┘
```

### API Calls

| Step | Method | What it returns |
|---|---|---|
| 1 | `schedule.queryEvents({ startAfter: todayStart, endBefore: todayEnd })` | Today's calendar events |
| 2 | `listTasks({ status: 'pending', due: { $lte: todayEnd } })` | Overdue + today-due tasks |
| 3 | `chat.saveMessage({ userId: 'alex', content: '...brief...' })` | Conversation record |

### Why This Matters

Alex never opens a calendar app, task tracker, or note system. The AI becomes the single window into everything that needs attention. The morning brief is the first interaction of the day — if it's seamless, the user trusts Knowy with everything else.

---

## Story 2: Meeting Capture

### Tagline

"During a design review, Alex captures notes and action items in one conversation. Two weeks later, he recalls the exact decision — including who owned it and why."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| Scribble notes in a notebook or text file | Say "take notes" — AI saves a Page |
| Later: "where did I put those notes?" | `channel.search("API migration")` finds it instantly |
| Action items exist only in memory or separate to-do list | AI creates Tasks with `sourceMessageId` back to the discussion |
| "Why did we decide this?" — scroll through chat logs | Follow `sourceMessageId` → original context in one hop |

### The Flow

```
         Meeting time
              │
              ▼
┌──────────────────────────────┐
│  Alex: "take notes"          │
│  AI saves Page with summary  │
└──────────────────────────────┘
              │
              ▼
┌──────────────────────────────┐
│  Person: "I'll own the API   │
│  migration"                  │
│  Alex: "add a task, due next │
│  Friday"                     │
│  AI saves Task with          │
│  sourceMessageId → message   │
└──────────────────────────────┘
              │
              ▼  (two weeks later)
┌──────────────────────────────┐
│  Alex: "what did we decide   │
│  about the API migration?"   │
│  AI: channel.search(query)   │
│       ┌─────────┐ ┌──────┐  │
│       │  Page   │ │ Task │  │
│       └────┬────┘ └──┬───┘  │
│            └────┬────┘      │
│           sourceMessageId   │
│                 │           │
│          ┌──────┴──────┐    │
│          │  Original   │    │
│          │  Message    │    │
│          │  in Chat    │    │
│          └─────────────┘    │
└──────────────────────────────┘
```

### API Calls

| Step | Method | What it does |
|---|---|---|
| 1 | `channel.savePage({ title, md, sourceMessageId })` | Persists meeting notes |
| 2 | `channel.saveTask({ title, due, status, sourceMessageId })` | Creates tracked action item |
| 3 | `channel.search("API migration", { collection: 'pages' })` | Finds the notes weeks later |
| 4 | (trace) `chat.getMessage(sourceMessageId)` | Shows the conversation context |

### Key Insight

The `sourceMessageId` field turns every entity into a breadcrumb back to its origin conversation. This is the difference between "a task appeared in my list" and "I know exactly why this task exists."

---

## Story 3: Decision Traceability

### Tagline

"Alex spots a task 'Update CI pipeline — due tomorrow' and asks 'why?' The AI walks the breadcrumb trail back to the exact moment the decision was made."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| Task appears in your list with no context | Every Task carries its origin story |
| Scroll through days of chat history to find "why" | One query: `getMessage(task.sourceMessageId)` |
| Or worse: ask a colleague "why did we add this?" | AI surfaces it without interrupting anyone |
| Decision context is lost when conversations move | `sourceMessageId` is immutable — never lost |

### The Flow

```
  "Why does this task exist?"
         │
         ▼
  ┌──────────────┐
  │    Task      │
  │  "Update CI  │
  │   pipeline"  │
  │  sourceMsgId │────┐
  └──────────────┘    │
                      ▼
              ┌────────────────┐
              │   Message      │
              │  "The build is │
              │   failing, we  │
              │   agreed to    │
              │   fix the CI   │
              │   pipeline.    │
              │   @danny owns" │
              │                │
              │  sessionId ────┤──► Chat "Dev Ops"
              └────────────────┘
```

### API Calls

| Step | Method | What it does |
|---|---|---|
| 1 | `channel.getTask(taskId)` | Gets the Task, reads `sourceMessageId` |
| 2 | `chat.getMessage(sourceMessageId)` | Retrieves the original context message |
| 3 | (optional) `chat.listMessages({ after: sourceMessageId, limit: 10 })` | Reads follow-up discussion |

### Why This Matters

Tasks are commitments. When a commitment appears without context, it creates cognitive load ("should I do this? do I know why this matters?"). `sourceMessageId` eliminates that load — the answer is always one hop away.

---

## Story 4: Company Knowledge Base

### Tagline

"HR sends the new remote-work policy. Alex says 'save this.' Months later, he answers a colleague's question in seconds without re-reading the document."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| Important documents get buried in email/chat | Saved to a searchable KnowledgeBase |
| "I know we have a policy on this somewhere..." | `kb.search("WFH")` → instant answer |
| Re-read the whole document to find one answer | AI surfaces the exact `answer` field |
| Knowledge lives in one person's head | Knowledge lives in a structured, AI-queryable form |

### The Flow

```
  Alex pastes the policy document
         │
         ▼
  ┌─────────────────────────────────────┐
  │  AI: "Save this as reference"       │
  │  channel.knowledge('Company Policy') │──► lazily creates kb_company_policy
  │  kb.saveArticle({                    │      collection
  │    title: 'Remote Work Policy',      │
  │    content: '(full document text)',  │
  │    answer: 'Employees can WFH up     │
  │            to 3 days per week.'      │
  │  })                                  │
  └─────────────────────────────────────┘
                    │
                    ▼  (months later)
  ┌─────────────────────────────────────┐
  │  Alex: "how many WFH days do we     │
  │  get?"                              │
  │  AI: kb.search("work from home")    │
  │       ┌──────────────────────┐      │
  │       │ Vector + FTS5 search │      │
  │       │ → scores 0.92        │      │
  │       │ → returns Article    │      │
  │       │ → reads answer field │      │
  │       └──────────────────────┘      │
  │                                     │
  │  AI: "Up to 3 days per week.        │
  │       Want me to open the full      │
  │       policy?"                      │
  └─────────────────────────────────────┘
```

### API Calls

| Step | Method | What it does |
|---|---|---|
| 1 | `channel.knowledge('Company Policy')` | Gets or creates the KB (lazy) |
| 2 | `kb.saveArticle({ title, content, answer })` | Stores the document |
| 3 | `kb.search("work from home", { limit: 3 })` | RAG search → ranked results |
| 4 | (read result.entity for the full Article) | Retrieves the match |

### Article Structure

```
┌──────────────────────────────────────┐
│              Article                  │
├──────────────────────────────────────┤
│  title:    "Remote Work Policy"       │
│  content:  "Effective June 2026..."   │
│            [full document body]       │
│  answer:   "Employees can WFH up to   │
│            3 days per week. Manager   │
│            approval required for      │
│            more than 3 days."         │
│  sourceMessageId: "66a3..."           │
│  createdAt: "2026-06-01T10:00:00Z"   │
│  updatedAt: "2026-06-01T10:00:00Z"   │
└──────────────────────────────────────┘
```

### Why This Matters

The `answer` field is the key innovation here. It lets the AI answer instantly without re-reading the full document. The `content` is there for depth when needed. This is the difference between "let me check" and "here's your answer."

---

## Story 5: Quick Capture

### Tagline

"Alex is on a walk and thinks of an idea. He tells his AI. A week later at his desk, he asks 'what was that idea about SQLite?' and it's right there."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| Brilliant idea → forget it 10 minutes later | Dictate it to the AI → stored forever |
| "I had a thought about caching last week..." | Search by keyword → found instantly |
| Notes scattered across phone, laptop, sticky notes | All notes in one searchable place |
| Organizing notes is overhead you skip | The AI does the saving — no friction |

### The Flow

```
    ┌──────────┐
    │ On a walk│
    └────┬─────┘
         │ "Note: explore SQLite-based
         │  caching for the reporting service"
         ▼
    ┌──────────────────┐
    │ AI: saveNote()   │──► Knowy stores in `notes` collection
    └──────────────────┘    with ordinary index on `title`
         │
         ▼  (a week later, at desk)
    ┌──────────────────┐
    │ "What was that   │
    │  idea about      │
    │  SQLite?"        │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ AI: listNotes({  │──► Knowy uses `title` ordinary index
    │  title: {        │    → fast lookup
    │   $regex:'SQLite'│
    │  }               │
    │ })               │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Returns:         │
    │ "explore SQLite- │
    │  based caching   │
    │  for the         │
    │  reporting       │
    │  service"        │
    └──────────────────┘
```

### API Calls

| Step | Method | What it does |
|---|---|---|
| 1 | `channel.saveNote({ title, content, sourceMessageId })` | Persists the quick thought |
| 2 | `listNotes({ title: { $regex: 'SQLite' } })` | Searches by title using ordinary index |

### Note vs. Page — When to Use What

| Criterion | Note | Page |
|---|---|---|
| Lifespan | Transient (quick thought, phone number) | Durable (meeting notes, project plan) |
| Structure | Minimal — title + content | Structured markdown |
| Primary access | Search by title/content | Browse, re-read, reference |
| Example | "explore SQLite caching" | "Q3 Planning Meeting Minutes" |

### Why This Matters

The friction of "saving an idea" is normally high enough that most ideas are lost. Knowy eliminates the friction: the user just talks to the AI. The AI decides whether it's a Note (quick capture) or a Page (structured document). The user doesn't even need to know the difference.

---

## Story 6: Context Resume

### Tagline

"Yesterday Alex planned the Q3 roadmap. Today he says 'continue where we left off.' The AI finds the right conversation, picks up the thread, and summarizes what was already done."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| "Which chat was that in?" — scroll through 10 sessions | `listChats()` → sorted by recency → found by title |
| "What did we already cover?" — re-read everything | AI fetches recent messages and linked entities |
| "What tasks came out of that conversation?" — manually track | AI follows `sourceMessageId` back-links |
| New session → AI doesn't know what happened before | Same channel → full queryable history |

### The Flow

```
  Day 1                                  Day 2
┌────────────────────────┐    ┌────────────────────────┐
│ "Let's plan Q3"        │    │ "Continue where we     │
│                        │    │  left off"             │
│ AI saves Chat:         │    │                        │
│ "Q3 Roadmap Planning"  │    │ 1. listChats()          │
│                        │    │    → find by title      │
│ Creates Tasks:         │    │ 2. listMessages({       │
│  • Research market     │    │      limit: 50 })       │
│  • Draft timeline      │    │    → last 50 messages   │
│  • Identify risks      │    │    → pick up thread     │
│                        │    │                        │
│ Creates Event:         │    │ 3. listTasks({          │
│  • Review meeting      │    │      filter by chat })  │
│    next Tuesday        │    │    → what's pending     │
│                        │    │    → what's done        │
│ All linked via         │    │                        │
│ sourceMessageId        │    │ AI: "We planned the    │
│                        │    │ roadmap, created 3     │
│                        │    │ tasks. Research is     │
│                        │    │ still pending. Ready   │
│                        │    │ to pick it up?"        │
└────────────────────────┘    └────────────────────────┘
```

### What listChats Returns

```ts
// Ordered by updatedAt descending (most recent first)
[
  {
    sessionId: "66a1...",
    title: "Q3 Roadmap Planning",
    createdAt: "2026-06-18T14:00:00Z",
    updatedAt: "2026-06-18T15:30:00Z",  // last message sent
    messageCount: 24
  },
  {
    sessionId: "66a2...",
    title: "Dev Ops Discussion",
    createdAt: "2026-06-17T09:00:00Z",
    updatedAt: "2026-06-17T10:15:00Z",
    messageCount: 12
  }
]
```

### Why This Matters

Conversations with AI are currently stateless — every session starts blank. Knowy makes them stateful. The Chat session is the container for a thread of work. The user can walk away for a day, a week, or a month and come back without losing context. This is the foundation of AI as a long-term collaborator, not a one-shot Q&A machine.

---

## Story 7: Recurring Life Admin

### Tagline

"Alex tells his AI 'remind me to pay rent on the 1st.' On the 1st, it appears in his morning brief. He says 'paid' and it's done. Next month the cycle repeats."

### The Pain Point

| Before Knowy | After Knowy |
|---|---|
| Set recurring reminders in a separate app | One sentence creates the pattern |
| Miss a month → forget → late fee | Task appears in the morning brief automatically |
| "Did I pay rent this month?" — check bank app | `listTasks({ status: 'done', title: 'rent' })` — yes |
| Recurring tasks clutter your task list | Only one active instance at a time |

### The Flow

```
  "Remind me to pay rent
   on the 1st of every month"
          │
          ▼
  ┌───────────────────────────────────┐
  │ AI: Creates Task                 │
  │  title:  "Pay rent"              │
  │  due:    "2026-07-01"            │
  │  status: "pending"               │
  │  detail: "Rent is $1500,         │
  │           due by 5th to avoid    │
  │           late fee"              │
  └───────────────────────────────────┘
          │
          ▼  (July 1st morning brief)
  ┌───────────────────────────────────┐
  │ "You have 1 pending task:        │
  │  Pay rent — due today ($1500).   │
  │  Want me to mark it done?"       │
  └───────────────────────────────────┘
          │
          ▼  "Paid it"
  ┌───────────────────────────────────┐
  │ AI: updateTask(id,               │
  │      { status: 'done' })         │
  │                                  │
  │ (External cron: creates new      │
  │  Task for Aug 1st)               │
  └───────────────────────────────────┘
```

### API Calls

| Step | Method | What it does |
|---|---|---|
| 1 | `channel.saveTask({ title: 'Pay rent', due: '2026-07-01', status: 'pending', sourceMessageId })` | Creates the recurring instance |
| 2 | `listTasks({ status: 'pending', due: { $lte: '2026-07-01' } })` | Morning brief query finds it |
| 3 | `updateTask(id, { status: 'done' })` | Marks complete |
| 4 | (external) `channel.saveTask({ ... due: '2026-08-01' })` | Next month's instance |

### Task Lifecycle

```
  ┌──────────┐    ┌──────────────┐    ┌──────────┐
  │ pending  │───►│ in_progress  │───►│   done   │
  └──────────┘    └──────────────┘    └──────────┘
       │                                     ▲
       │         ┌────────────┐              │
       └────────►│ cancelled  │──────────────┘
                  └────────────┘
  (Free transitions: any state to any state)
```

### Why This Matters

Life admin is high-frequency, low-cognitive-load work. It's the perfect use case for an AI assistant — the user never thinks "I need to remember to set a reminder." They just say what they need once, and Knowy handles the persistence. The AI surfaces it at the right time, and the user dismisses it with a word.

---

## Entity Interaction Map

How the 7 stories exercise the entity relationships:

```
                           ┌──────────┐
                           │  Chat   │
                           ├──────────┤
              ┌────────────┤ Messages │◄────────────┐
              │            └──────────┘              │
              │  sourceMessageId                     │
              ▼                                      │
 ┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐│
 │  Page  │ │ Task │ │ Note │ │Event │ │ Article  ││
 │ (Story │ │(St.1 │ │(St.5)│ │(St.1)│ │ (St.4)   ││
 │  2)    │ │ 3,7) │ │      │ │      │ │          ││
 └────────┘ └──────┘ └──────┘ └──────┘ └──────────┘│
                                                     │
  channel.search() searches across ──────────────────┘
  all RAG-indexed fields (Page.md,
  Note.content, Task.title, etc.)
```

---

## Summary: Stories → API Methods

| Story | Methods Used | Key Feature |
|---|---|---|
| 1. Morning Briefing | `queryEvents`, `listTasks` | Cross-entity synthesis |
| 2. Meeting Capture | `savePage`, `saveTask`, `search` | `sourceMessageId` traceability |
| 3. Decision Traceability | `getTask`, `getMessage` | Breadcrumb trail |
| 4. Company KB | `knowledge()`, `saveArticle`, `search` | RAG + `answer` field |
| 5. Quick Capture | `saveNote`, `listNotes` | Low-friction capture + ordinary index |
| 6. Context Resume | `listChats`, `listMessages`, `listTasks` | Pagination + recency ordering |
| 7. Recurring Life Admin | `saveTask`, `listTasks`, `updateTask` | Status transitions + free-form workflow |

---

## Cross-cutting Concerns

| Concern | How Knowy Addresses It |
|---|---|
| **AI amnesia** | Persistent storage + `sourceMessageId` links conversations to data |
| **Context switching** | Single API surface across all entity types |
| **Information retrieval** | RAG search (`channel.search`, `kb.search`) + ordinary indexes |
| **Data fragmentation** | All entities in one channel, one anigodb database |
| **Capture friction** | Natural language → AI → API (user never touches the API directly) |
