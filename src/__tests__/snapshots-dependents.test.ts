import { describe, it, expect } from 'vitest';
import { getStoredDependentRepos, type StoredDependentRepos } from '../lib/snapshots';

describe('StoredDependentRepos interface', () => {
  it('holds count and date', () => {
    const result: StoredDependentRepos = { count: 42, date: '2026-03-18' };
    expect(result.count).toBe(42);
    expect(result.date).toBe('2026-03-18');
  });

  it('allows null count and date for the no-snapshot case', () => {
    const result: StoredDependentRepos = { count: null, date: null };
    expect(result.count).toBeNull();
    expect(result.date).toBeNull();
  });
});

describe('getStoredDependentRepos', () => {
  it('returns { count: null, date: null } when no database is available', async () => {
    // DATABASE_URL is not set in the test environment, so getDb() returns null,
    // getOrCreateSDK() throws, and the try/catch falls back to nulls.
    // This exercises the real fallback code path without any mocking.
    const result = await getStoredDependentRepos();
    expect(result).toEqual({ count: null, date: null });
  });

  it('always resolves (never rejects), even without a database', async () => {
    // The try/catch in getStoredDependentRepos must swallow DB errors.
    await expect(getStoredDependentRepos()).resolves.toBeDefined();
  });
});
