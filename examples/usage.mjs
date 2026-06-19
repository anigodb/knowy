import knowy from '../dist/esm/index.js';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = mkdtempSync(join('knowy-example-'));
const channel = knowy.channel(dir);

// ── Users ──
const alice = channel.saveUser({ name: 'Alice' });
const bob = channel.saveUser({ name: 'Bob', metadata: { role: 'admin' } });
console.log('Users:', channel.listUsers().map(u => u.name));

// ── Pages ──
const page = channel.savePage({ title: 'Meeting Notes', md: '# Q3 Planning' });
console.log('Page:', channel.getPage(page.id).title);

// ── Notes ──
const note = channel.saveNote({ title: 'Idea', content: 'Use vector search for RAG' });
console.log('Note:', channel.getNote(note.id).content);

// ── Tasks ──
const task = channel.saveTask({ title: 'Deploy API', status: 'in_progress', detail: 'Push to production' });
channel.updateTask(task.id, { status: 'done' });
console.log('Task done:', channel.getTask(task.id).status);

// ── Files ──
const srcPath = join(dir, 'temp.txt');
writeFileSync(srcPath, 'hello world');
const file = channel.saveFile({ filename: 'hello.txt', path: srcPath });
console.log('File:', file.filename, `(${file.size} bytes)`);

// ── KnowledgeBase ──
const kb = channel.knowledge('Company Wiki');
kb.saveArticle({ title: 'Remote Policy', content: 'WFH up to 3 days/week.', answer: '3 days' });
console.log('KB article:', kb.getArticle(kb.listArticles()[0].id).title);

// ── Schedule ──
const sched = channel.schedule('Work');
sched.saveEvent({ title: 'Standup', start: '2026-06-19T09:00:00Z', end: '2026-06-19T09:15:00Z' });
const todayEvents = sched.queryEvents({ startAfter: '2026-06-19T00:00:00Z', endBefore: '2026-06-19T23:59:59Z' });
console.log('Today events:', todayEvents.map(e => e.title));

// ── Chat & Messages ──
const chat = channel.chat({ title: 'Dev Discussion' });
const root = chat.saveMessage({ userId: alice.id, content: 'Should we migrate to Postgres?' });
chat.saveMessage({ userId: bob.id, content: 'Yes, agreed.', reply: root.id });
const replies = chat.getReplies(root.id);
console.log('Replies:', replies.map(r => r.content));
console.log('Chat title:', chat.title);

// ── Cross-entity Search (creates RAG indexes on first call) ──
const results = channel.search('Postgres', { limit: 5 });
console.log('Search results:', results.map(r => `[${r.collection}] ${r.title} (score: ${r.score.toFixed(2)})`));

// ── Chat listing ──
console.log('Chat sessions:', channel.listChats().map(c => c.title));

// ── Source Message traceability ──
const tracedTask = channel.saveTask({
  title: 'Research Postgres migration',
  detail: 'Evaluate effort and risks',
  sourceMessageId: root.id,
});
console.log('From message:', tracedTask.sourceMessageId);

channel.close();
console.log('\nDone. Channel saved at:', dir);
