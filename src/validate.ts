export function assertKeys(input: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label}: unrecognized field "${key}"`);
    }
  }
}

export function assertString(value: unknown, name: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}: "${name}" is required and must be a non-empty string`);
  }
}

export function normalizeLinks(links?: string | string[]): string[] | undefined {
  if (links === undefined) return undefined;
  return Array.isArray(links) ? links : [links];
}
