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
      expect(user.id).toBeTruthy();
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
  });

  describe('Page CRUD', () => {
    it('saves and retrieves a page', () => {
      const page = channel.savePage({ title: 'Notes', md: '# Meeting Notes' });
      expect(page.id).toBeTruthy();
      expect(page.title).toBe('Notes');
      expect(page.md).toBe('# Meeting Notes');
      expect(page.createdAt).toBeTruthy();

      const got = channel.getPage(page.id);
      expect(got).not.toBeNull();
      expect(got!.title).toBe('Notes');
    });

    it('lists pages', () => {
      channel.savePage({ title: 'A', md: '# A' });
      channel.savePage({ title: 'B', md: '# B' });
      expect(channel.listPages().length).toBe(2);
    });

    it('updates a page', () => {
      const page = channel.savePage({ title: 'Old', md: 'old' });
      const updated = channel.updatePage(page.id, { title: 'New' });
      expect(updated.title).toBe('New');
      expect(updated.md).toBe('old');
    });

    it('deletes a page', () => {
      const page = channel.savePage({ title: 'X', md: '# X' });
      channel.deletePage(page.id);
      expect(channel.getPage(page.id)).toBeNull();
    });
  });

  describe('Note CRUD', () => {
    it('saves and retrieves a note', () => {
      const note = channel.saveNote({ title: 'Idea', content: 'Use SQLite' });
      expect(note.id).toBeTruthy();
      expect(note.content).toBe('Use SQLite');
    });

    it('lists notes with filter', () => {
      channel.saveNote({ title: 'Alpha', content: 'a' });
      channel.saveNote({ title: 'Beta', content: 'b' });
      const notes = channel.listNotes({ title: { $regex: 'Alpha' } });
      expect(notes.length).toBe(1);
      expect(notes[0].title).toBe('Alpha');
    });

    it('updates a note', () => {
      const note = channel.saveNote({ title: 'T', content: 'C' });
      const updated = channel.updateNote(note.id, { title: 'T2' });
      expect(updated.title).toBe('T2');
      expect(updated.content).toBe('C');
    });

    it('deletes a note', () => {
      const note = channel.saveNote({ title: 'T', content: 'C' });
      channel.deleteNote(note.id);
      expect(channel.getNote(note.id)).toBeNull();
    });
  });

  describe('Task CRUD', () => {
    it('saves a task with default status', () => {
      const task = channel.saveTask({ title: 'Buy milk', detail: 'Buy at store' });
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
  });

  describe('File CRUD', () => {
    it('saves a file reference', () => {
      const srcPath = path.join(dir, 'test-file.txt');
      fs.writeFileSync(srcPath, 'hello world');
      const file = channel.saveFile({ filename: 'hello.txt', path: srcPath });
      expect(file.id).toBeTruthy();
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
  });

  describe('Chat & Messages', () => {
    it('creates a chat and sends messages', () => {
      const chat = channel.chat();
      expect(chat.sessionId).toBeTruthy();
      expect(chat.title).toBe('');

      const msg = chat.saveMessage({ userId: 'alice', content: 'Hello' });
      expect(msg.id).toBeTruthy();
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
      expect(article.id).toBeTruthy();
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
  });

  describe('Schedule', () => {
    it('saves and retrieves events', () => {
      const sched = channel.schedule('Work');
      const event = sched.saveEvent({
        title: 'Standup',
        start: '2026-06-19T09:00:00Z',
        end: '2026-06-19T09:15:00Z',
      });
      expect(event.id).toBeTruthy();
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
  });

  describe('Search', () => {
    it('searches across collections', () => {
      channel.savePage({ title: 'Project Plan', md: 'Build the AI assistant' });
      channel.saveNote({ title: 'Idea', content: 'AI assistant with RAG' });
      channel.saveTask({ title: 'Setup RAG', detail: 'Configure the RAG pipeline' });

      const results = channel.search('AI assistant', { limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].collection).toBeTruthy();
      expect(results[0].id).toBeTruthy();
    });

    it('searches in a specific collection', () => {
      channel.savePage({ title: 'Alpha', md: 'First project' });
      channel.saveNote({ title: 'Beta', content: 'Some note' });

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
});
