import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Channel } from '../src/channel.js';

const TEST_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'knowy-test-'));
}

describe('Channel', () => {
  let dir: string;
  let channel: Channel;

  beforeEach(() => {
    dir = tmpDir();
    channel = new Channel(dir, TEST_KEY);
  });

  afterEach(() => {
    channel.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('User CRUD', () => {
    it('saves and retrieves a user', () => {
      const user = channel.saveUser({ name: 'Alice', metadata: { role: 'admin' } });
      expect(user.id).toMatch(/^user-/);
      expect(user.name).toBe('Alice');
      expect(user.metadata).toEqual({ role: 'admin' });
      expect(user.createdAt).toBeTruthy();
      expect(user.updatedAt).toBeTruthy();

      const got = channel.getUser(user.id);
      expect(got).not.toBeNull();
      expect(got!.name).toBe('Alice');
    });

    it('returns null for missing user', () => {
      expect(channel.getUser('nonexistent')).toBeNull();
    });

    it('lists users', () => {
      channel.saveUser({ name: 'Alice' });
      channel.saveUser({ name: 'Bob' });
      const users = channel.listUsers();
      expect(users.length).toBe(2);
    });

    it('updates a user', () => {
      const user = channel.saveUser({ name: 'Alice' });
      const updated = channel.updateUser(user.id, { name: 'Alicia' });
      expect(updated.name).toBe('Alicia');
      expect(updated.updatedAt >= user.updatedAt).toBe(true);
    });

    it('deletes a user', () => {
      const user = channel.saveUser({ name: 'Alice' });
      channel.deleteUser(user.id);
      expect(channel.getUser(user.id)).toBeNull();
    });

    it('rejects saveUser with unknown keys', () => {
      expect(() => channel.saveUser({ name: 'X', tag: 'bad' as never })).toThrow('saveUser: unrecognized field "tag"');
    });

    it('rejects saveUser with empty name', () => {
      expect(() => channel.saveUser({ name: '' })).toThrow('saveUser: "name" is required');
    });

    it('rejects updateUser with unknown keys', () => {
      const user = channel.saveUser({ name: 'X' });
      expect(() => channel.updateUser(user.id, { md: 'bad' as never })).toThrow('updateUser: unrecognized field "md"');
    });
  });

  describe('Page CRUD', () => {
    it('saves and retrieves a page', () => {
      const page = channel.savePage({ title: 'Notes', content: '# Meeting Notes' });
      expect(page.id).toMatch(/^page-/);
      expect(page.title).toBe('Notes');
      expect(page.content).toBe('# Meeting Notes');
      expect(page.createdAt).toBeTruthy();

      const got = channel.getPage(page.id);
      expect(got).not.toBeNull();
      expect(got!.title).toBe('Notes');
    });

    it('lists pages', () => {
      channel.savePage({ title: 'A', content: '# A' });
      channel.savePage({ title: 'B', content: '# B' });
      expect(channel.listPages().length).toBe(2);
    });

    it('updates a page', () => {
      const page = channel.savePage({ title: 'Old', content: 'old' });
      const updated = channel.updatePage(page.id, { title: 'New' });
      expect(updated.title).toBe('New');
      expect(updated.content).toBe('old');
    });

    it('deletes a page', () => {
      const page = channel.savePage({ title: 'X', content: '# X' });
      channel.deletePage(page.id);
      expect(channel.getPage(page.id)).toBeNull();
    });

    it('defaults type to md', () => {
      const page = channel.savePage({ title: 'NoType', content: 'hello' });
      expect(page.type).toBe('md');
    });

    it('accepts explicit type', () => {
      const page = channel.savePage({ title: 'HTML', content: '<p>hi</p>', type: 'html' });
      expect(page.type).toBe('html');
    });

    it('updates type', () => {
      const page = channel.savePage({ title: 'Switch', content: 'text', type: 'text' });
      const updated = channel.updatePage(page.id, { type: 'md' });
      expect(updated.type).toBe('md');
    });

    it('rejects unknown fields like md', () => {
      expect(() =>
        channel.savePage({ title: 'Bad', md: 'should not work' })
      ).toThrow();
    });

    it('rejects missing content', () => {
      expect(() =>
        channel.savePage({ title: 'NoContent' })
      ).toThrow();
    });

    it('rejects updatePage with unknown keys', () => {
      const page = channel.savePage({ title: 'X', content: 'x' });
      expect(() => channel.updatePage(page.id, { md: 'bad' as never })).toThrow('updatePage: unrecognized field "md"');
    });
  });

  describe('Task CRUD', () => {
    it('saves a task with default status', () => {
      const task = channel.saveTask({ title: 'Buy milk', detail: 'Buy at store' });
      expect(task.id).toMatch(/^task-/);
      expect(task.status).toBe('pending');
    });

    it('saves a task with explicit status', () => {
      const task = channel.saveTask({ title: 'Deploy', status: 'in_progress', detail: 'Deploy to prod' });
      expect(task.status).toBe('in_progress');
    });

    it('lists tasks with filter', () => {
      channel.saveTask({ title: 'A', status: 'pending', detail: 'task a' });
      channel.saveTask({ title: 'B', status: 'done', detail: 'task b' });
      const pending = channel.listTasks({ status: 'pending' });
      expect(pending.length).toBe(1);
    });

    it('updates task status', () => {
      const task = channel.saveTask({ title: 'X', detail: 'some detail' });
      const done = channel.updateTask(task.id, { status: 'done' });
      expect(done.status).toBe('done');
    });

    it('deletes a task', () => {
      const task = channel.saveTask({ title: 'X', detail: 'some detail' });
      channel.deleteTask(task.id);
      expect(channel.getTask(task.id)).toBeNull();
    });

    it('rejects saveTask with unknown keys', () => {
      expect(() => channel.saveTask({ title: 'X', md: 'bad' as never })).toThrow('saveTask: unrecognized field "md"');
    });

    it('rejects saveTask with empty title', () => {
      expect(() => channel.saveTask({ title: '' })).toThrow('saveTask: "title" is required');
    });

    it('rejects updateTask with unknown keys', () => {
      const task = channel.saveTask({ title: 'X' });
      expect(() => channel.updateTask(task.id, { md: 'bad' as never })).toThrow('updateTask: unrecognized field "md"');
    });
  });

  describe('File CRUD', () => {
    it('saves a file reference', () => {
      const srcPath = path.join(dir, 'test-file.txt');
      fs.writeFileSync(srcPath, 'hello world');
      const file = channel.saveFile({ filename: 'hello.txt', path: srcPath });
      expect(file.id).toMatch(/^file-/);
      expect(file.filename).toBe('hello.txt');
      expect(file.size).toBe(11);

      const got = channel.getFile(file.id);
      expect(got).not.toBeNull();
      expect(got!.filename).toBe('hello.txt');
    });

    it('lists files', () => {
      const srcPath = path.join(dir, 'a.txt');
      fs.writeFileSync(srcPath, 'a');
      channel.saveFile({ filename: 'a.txt', path: srcPath });
      channel.saveFile({ filename: 'b.txt', path: srcPath });
      expect(channel.listFiles().length).toBe(2);
    });

    it('deletes a file', () => {
      const srcPath = path.join(dir, 'x.txt');
      fs.writeFileSync(srcPath, 'x');
      const file = channel.saveFile({ filename: 'x.txt', path: srcPath });
      channel.deleteFile(file.id);
      expect(channel.getFile(file.id)).toBeNull();
    });

    it('rejects saveFile with unknown keys', () => {
      const srcPath = path.join(dir, 'x.txt');
      fs.writeFileSync(srcPath, 'x');
      expect(() => channel.saveFile({ filename: 'x.txt', path: srcPath, md: 'bad' as never })).toThrow('saveFile: unrecognized field "md"');
    });

    it('rejects saveFile with empty filename', () => {
      expect(() => channel.saveFile({ filename: '', path: 'x.txt' })).toThrow('saveFile: "filename" is required');
    });

    it('rejects saveFile with empty path', () => {
      expect(() => channel.saveFile({ filename: 'x.txt', path: '' })).toThrow('saveFile: "path" is required');
    });

    it('rejects updateFile with unknown keys', () => {
      const srcPath = path.join(dir, 'x.txt');
      fs.writeFileSync(srcPath, 'x');
      const file = channel.saveFile({ filename: 'x.txt', path: srcPath });
      expect(() => channel.updateFile(file.id, { md: 'bad' as never })).toThrow('updateFile: unrecognized field "md"');
    });
  });

  describe('Chat & Messages', () => {
    it('creates a chat and sends messages', () => {
      const chat = channel.chat();
      expect(chat.sessionId).toMatch(/^chat-/);
      expect(chat.title).toBe('');

      const msg = chat.saveMessage({ userId: 'alice', content: 'Hello' });
      expect(msg.id).toMatch(/^message-/);
      expect(msg.content).toBe('Hello');
      expect(msg.sessionId).toBe(chat.sessionId);
    });

    it('creates a chat with title', () => {
      const chat = channel.chat({ title: 'My Chat' });
      expect(chat.title).toBe('My Chat');
    });

    it('resumes an existing chat', () => {
      const chat1 = channel.chat({ title: 'Resume Test' });
      chat1.saveMessage({ userId: 'alice', content: 'First' });

      const chat2 = channel.chat(chat1.sessionId);
      expect(chat2.sessionId).toBe(chat1.sessionId);
      expect(chat2.title).toBe('Resume Test');

      const msgs = chat2.listMessages();
      expect(msgs.length).toBe(1);
      expect(msgs[0].content).toBe('First');
    });

    it('lists messages with pagination', () => {
      const chat = channel.chat();
      for (let i = 0; i < 5; i++) {
        chat.saveMessage({ userId: 'alice', content: `msg${i}` });
      }
      const msgs = chat.listMessages({ limit: 3 });
      expect(msgs.length).toBe(3);
    });

    it('deletes a message', () => {
      const chat = channel.chat();
      const msg = chat.saveMessage({ userId: 'alice', content: 'Delete me' });
      chat.deleteMessage(msg.id);
      expect(chat.getMessage(msg.id)).toBeNull();
    });

    it('sets chat title', () => {
      const chat = channel.chat();
      chat.setTitle('New Title');
      expect(chat.title).toBe('New Title');
    });

    it('lists chats', () => {
      channel.chat({ title: 'Chat A' });
      channel.chat({ title: 'Chat B' });
      const chats = channel.listChats();
      expect(chats.length).toBe(2);
      expect(chats.map(c => c.title).sort()).toEqual(['Chat A', 'Chat B']);
    });

    it('rejects saveMessage with unknown keys', () => {
      const chat = channel.chat();
      expect(() => chat.saveMessage({ userId: 'alice', content: 'Hello', tag: ['bob'] as never })).toThrow('saveMessage: unrecognized field "tag"');
    });

    it('rejects saveMessage with empty userId', () => {
      const chat = channel.chat();
      expect(() => chat.saveMessage({ userId: '', content: 'Hello' })).toThrow('saveMessage: "userId" is required');
    });

    it('rejects saveMessage with empty content', () => {
      const chat = channel.chat();
      expect(() => chat.saveMessage({ userId: 'alice', content: '' })).toThrow('saveMessage: "content" is required');
    });

    it('rejects setTitle with empty title', () => {
      const chat = channel.chat();
      expect(() => chat.setTitle('')).toThrow('setTitle: "title" is required');
    });
  });

  describe('getReplies', () => {
    it('returns direct replies to a message', () => {
      const chat = channel.chat();
      const root = chat.saveMessage({ userId: 'alice', content: 'Question?' });
      const reply1 = chat.saveMessage({ userId: 'bob', content: 'Answer 1', reply: root.id });
      const reply2 = chat.saveMessage({ userId: 'carol', content: 'Answer 2', reply: root.id });

      const replies = chat.getReplies(root.id);
      expect(replies.length).toBe(2);
      expect(replies.map(r => r.content).sort()).toEqual(['Answer 1', 'Answer 2']);
    });

    it('does not return non-reply messages', () => {
      const chat = channel.chat();
      const root = chat.saveMessage({ userId: 'alice', content: 'Root' });
      chat.saveMessage({ userId: 'bob', content: 'Unrelated' });
      expect(chat.getReplies(root.id).length).toBe(0);
    });

    it('only returns direct (one-level) replies', () => {
      const chat = channel.chat();
      const root = chat.saveMessage({ userId: 'alice', content: 'Root' });
      const reply = chat.saveMessage({ userId: 'bob', content: 'Reply', reply: root.id });
      chat.saveMessage({ userId: 'carol', content: 'Nested', reply: reply.id });

      const replies = chat.getReplies(root.id);
      expect(replies.length).toBe(1);
      expect(replies[0].content).toBe('Reply');
    });
  });

  describe('KnowledgeBase', () => {
    it('saves and retrieves articles', () => {
      const kb = channel.knowledge('Company Wiki');
      const article = kb.saveArticle({ title: 'Remote Policy', content: 'WFH 3 days per week', answer: '3 days' });
      expect(article.id).toMatch(/^article-/);
      expect(article.title).toBe('Remote Policy');

      const got = kb.getArticle(article.id);
      expect(got).not.toBeNull();
      expect(got!.answer).toBe('3 days');
    });

    it('lists articles', () => {
      const kb = channel.knowledge('Recipes');
      kb.saveArticle({ title: 'Pasta', content: '...' });
      kb.saveArticle({ title: 'Salad', content: '...' });
      expect(kb.listArticles().length).toBe(2);
    });

    it('updates an article', () => {
      const kb = channel.knowledge('Wiki');
      const article = kb.saveArticle({ title: 'Old', content: 'old content' });
      const updated = kb.updateArticle(article.id, { answer: 'New answer' });
      expect(updated.answer).toBe('New answer');
      expect(updated.title).toBe('Old');
    });

    it('deletes an article', () => {
      const kb = channel.knowledge('Wiki');
      const article = kb.saveArticle({ title: 'X', content: 'x' });
      kb.deleteArticle(article.id);
      expect(kb.getArticle(article.id)).toBeNull();
    });

    it('rejects saveArticle with unknown keys', () => {
      const kb = channel.knowledge('Wiki');
      expect(() => kb.saveArticle({ title: 'X', content: 'x', md: 'bad' as never })).toThrow('saveArticle: unrecognized field "md"');
    });

    it('rejects saveArticle with empty title', () => {
      const kb = channel.knowledge('Wiki');
      expect(() => kb.saveArticle({ title: '', content: 'x' })).toThrow('saveArticle: "title" is required');
    });

    it('rejects saveArticle with empty content', () => {
      const kb = channel.knowledge('Wiki');
      expect(() => kb.saveArticle({ title: 'X', content: '' })).toThrow('saveArticle: "content" is required');
    });

    it('rejects updateArticle with unknown keys', () => {
      const kb = channel.knowledge('Wiki');
      const article = kb.saveArticle({ title: 'X', content: 'x' });
      expect(() => kb.updateArticle(article.id, { md: 'bad' as never })).toThrow('updateArticle: unrecognized field "md"');
    });
  });

  describe('Schedule', () => {
    it('saves and retrieves events', () => {
      const sched = channel.schedule('Work');
      const event = sched.saveEvent({
        title: 'Standup',
        start: '2026-06-19T09:00:00Z',
        end: '2026-06-19T09:15:00Z',
      });
      expect(event.id).toMatch(/^event-/);
      expect(event.title).toBe('Standup');

      const got = sched.getEvent(event.id);
      expect(got).not.toBeNull();
      expect(got!.start).toBe('2026-06-19T09:00:00Z');
    });

    it('lists events', () => {
      const sched = channel.schedule('Personal');
      sched.saveEvent({ title: 'Lunch', start: '2026-06-19T12:00:00Z' });
      sched.saveEvent({ title: 'Dinner', start: '2026-06-19T19:00:00Z' });
      expect(sched.listEvents().length).toBe(2);
    });

    it('queries events by date range', () => {
      const sched = channel.schedule('Work');
      sched.saveEvent({ title: 'Early', start: '2026-06-01T00:00:00Z' });
      sched.saveEvent({ title: 'Mid', start: '2026-06-15T00:00:00Z' });
      sched.saveEvent({ title: 'Late', start: '2026-07-01T00:00:00Z' });

      const results = sched.queryEvents({
        startAfter: '2026-06-10T00:00:00Z',
        endBefore: '2026-06-30T00:00:00Z',
      });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Mid');
    });

    it('updates an event', () => {
      const sched = channel.schedule('Work');
      const event = sched.saveEvent({ title: 'Meeting', start: '2026-06-19T10:00:00Z' });
      const updated = sched.updateEvent(event.id, { title: 'Rescheduled' });
      expect(updated.title).toBe('Rescheduled');
    });

    it('deletes an event', () => {
      const sched = channel.schedule('Work');
      const event = sched.saveEvent({ title: 'X', start: '2026-06-19T00:00:00Z' });
      sched.deleteEvent(event.id);
      expect(sched.getEvent(event.id)).toBeNull();
    });

    it('rejects saveEvent with unknown keys', () => {
      const sched = channel.schedule('Work');
      expect(() => sched.saveEvent({ title: 'X', start: '2026-06-19T00:00:00Z', md: 'bad' as never })).toThrow('saveEvent: unrecognized field "md"');
    });

    it('rejects saveEvent with empty title', () => {
      const sched = channel.schedule('Work');
      expect(() => sched.saveEvent({ title: '', start: '2026-06-19T00:00:00Z' })).toThrow('saveEvent: "title" is required');
    });

    it('rejects saveEvent with empty start', () => {
      const sched = channel.schedule('Work');
      expect(() => sched.saveEvent({ title: 'X', start: '' })).toThrow('saveEvent: "start" is required');
    });

    it('rejects updateEvent with unknown keys', () => {
      const sched = channel.schedule('Work');
      const event = sched.saveEvent({ title: 'X', start: '2026-06-19T00:00:00Z' });
      expect(() => sched.updateEvent(event.id, { md: 'bad' as never })).toThrow('updateEvent: unrecognized field "md"');
    });
  });

  describe('Search', () => {
    it('searches across collections', () => {
      channel.savePage({ title: 'Project Plan', content: 'Build the AI assistant' });
      channel.savePage({ title: 'Idea', content: 'AI assistant with RAG', type: 'text' });
      channel.saveTask({ title: 'Setup RAG', detail: 'Configure the RAG pipeline' });

      const results = channel.search('AI assistant', { limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].collection).toBeTruthy();
      expect(results[0].id).toBeTruthy();
    });

    it('searches in a specific collection', () => {
      channel.savePage({ title: 'Alpha', content: 'First project' });
      channel.savePage({ title: 'Beta', content: 'Some note' });

      const results = channel.search('project', { collection: 'pages', limit: 5 });
      expect(results.every(r => r.collection === 'pages')).toBe(true);
    });
  });

  describe('Source Message traceability', () => {
    it('stores sourceMessageId on entities', () => {
      const chat = channel.chat();
      const msg = chat.saveMessage({ userId: 'alice', content: 'Create a task' });

      const task = channel.saveTask({
        title: 'Do something',
        detail: 'with detail',
        sourceMessageId: msg.id,
      });
      expect(task.sourceMessageId).toBe(msg.id);
    });
  });

  describe('Links', () => {
    it('saves a user with links', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      const user = channel.saveUser({ name: 'Alice', links: page.id });
      expect(user.links).toEqual([page.id]);
    });

    it('saves a page with links array', () => {
      const task = channel.saveTask({ title: 'T' });
      const page = channel.savePage({ title: 'P', content: 'c', links: [task.id] });
      expect(page.links).toEqual([task.id]);
    });

    it('saves a task with links', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      const task = channel.saveTask({ title: 'T', links: [page.id] });
      expect(task.links).toEqual([page.id]);
    });

    it('saves a file with links', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      const srcPath = path.join(dir, 'f.txt');
      fs.writeFileSync(srcPath, 'x');
      const file = channel.saveFile({ filename: 'f.txt', path: srcPath, links: [page.id] });
      expect(file.links).toEqual([page.id]);
    });

    it('saves a message with links', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      const chat = channel.chat();
      const msg = chat.saveMessage({ userId: 'alice', content: 'hello', links: [page.id] });
      expect(msg.links).toEqual([page.id]);
    });

    it('saves an article with links', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      const kb = channel.knowledge('Test');
      const article = kb.saveArticle({ title: 'A', content: 'c', links: [page.id] });
      expect(article.links).toEqual([page.id]);
    });

    it('saves an event with links', () => {
      const task = channel.saveTask({ title: 'T' });
      const sched = channel.schedule('Work');
      const event = sched.saveEvent({ title: 'E', start: '2026-06-19T10:00:00Z', links: [task.id] });
      expect(event.links).toEqual([task.id]);
    });

    it('updates links on a user', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      const user = channel.saveUser({ name: 'Alice' });
      const updated = channel.updateUser(user.id, { links: [page.id] });
      expect(updated.links).toEqual([page.id]);
    });

    it('updates links on a page', () => {
      const task = channel.saveTask({ title: 'T' });
      const page = channel.savePage({ title: 'P', content: 'c' });
      const updated = channel.updatePage(page.id, { links: [task.id] });
      expect(updated.links).toEqual([task.id]);
    });

    it('updating without links does not clear existing links', () => {
      const task = channel.saveTask({ title: 'T' });
      const page = channel.savePage({ title: 'P', content: 'c', links: [task.id] });
      const updated = channel.updatePage(page.id, { title: 'Renamed' });
      expect(updated.links).toEqual([task.id]);
    });

    it('clears links with empty array', () => {
      const task = channel.saveTask({ title: 'T' });
      const page = channel.savePage({ title: 'P', content: 'c', links: [task.id] });
      const updated = channel.updatePage(page.id, { links: [] });
      expect(updated.links).toEqual([]);
    });

    it('rejects save with nonexistent link', () => {
      expect(() =>
        channel.savePage({ title: 'P', content: 'c', links: ['page-nope'] })
      ).toThrow('page-nope');
    });

    it('rejects update with nonexistent link', () => {
      const page = channel.savePage({ title: 'P', content: 'c' });
      expect(() =>
        channel.updatePage(page.id, { links: ['task-nope'] })
      ).toThrow('task-nope');
    });

    it('accepts links as valid optional field', () => {
      const page = channel.savePage({ title: 'NoLinks', content: 'ok' });
      expect(page.links).toBeUndefined();
    });
  });
});
