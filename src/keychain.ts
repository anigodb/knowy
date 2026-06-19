import { Entry } from '@napi-rs/keyring';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SERVICE = 'knowy';

export function getOrCreateKey(channelPath: string): string {
  try {
    const entry = new Entry(SERVICE, channelPath);
    const existing = entry.getPassword();
    if (existing) return existing;
    const key = generateKey();
    entry.setPassword(key);
    return key;
  } catch {
    return getOrCreateFileKey(channelPath);
  }
}

function getOrCreateFileKey(channelPath: string): string {
  const keyPath = path.join(channelPath, 'knowy.key');
  try {
    const existing = fs.readFileSync(keyPath, 'utf-8').trim();
    if (existing.length === 64) return existing;
  } catch {
  }
  const key = generateKey();
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function generateKey(): string {
  return randomBytes(32).toString('hex');
}
