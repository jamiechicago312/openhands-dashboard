import { getDb } from './db';
import { sdks, metricsSnapshots } from './schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAllGitHubMetrics, getDependentReposCount } from './github';
import { getPyPIDownloads } from './pypi';
import { SDK_CONFIG } from './sdk-config';

export interface SnapshotData {
  githubStars: number;
  githubForks: number;
  githubActiveForks: number;
  githubContributors: number;
  githubRepeatContributors: number;
  githubDependentRepos: number | null;
  npmDownloadsWeekly: number | null;
  pypiDownloadsWeekly: number;
}

/**
 * Get or create the tracked repository record in the database
 */
export async function getOrCreateSDK(): Promise<number> {
  const db = getDb();
  if (!db) throw new Error('Database not available');
  
  // Check if the tracked repository already exists
  const existing = await db
    .select()
    .from(sdks)
    .where(eq(sdks.githubRepo, `${SDK_CONFIG.github.owner}/${SDK_CONFIG.github.repo}`))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create a new tracked repository record
  const result = await db
    .insert(sdks)
    .values({
      name: SDK_CONFIG.name,
      githubRepo: `${SDK_CONFIG.github.owner}/${SDK_CONFIG.github.repo}`,
      npmPackage: null,
      pypiPackage: SDK_CONFIG.pypi.package,
    })
    .returning({ id: sdks.id });

  return result[0].id;
}

/**
 * Collect current metrics from all APIs
 */
export async function collectCurrentMetrics(): Promise<SnapshotData> {
  const [github, pypi, dependentRepos] = await Promise.all([
    getAllGitHubMetrics(SDK_CONFIG.github.owner, SDK_CONFIG.github.repo),
    getPyPIDownloads(SDK_CONFIG.pypi.package),
    getDependentReposCount([...SDK_CONFIG.dependencySearches]).catch(() => null),
  ]);

  return {
    githubStars: github.stars,
    githubForks: github.forks,
    githubActiveForks: github.activeForks,
    githubContributors: github.totalContributors,
    githubRepeatContributors: github.repeatContributors,
    githubDependentRepos: dependentRepos,
    npmDownloadsWeekly: null, // Python SDK only
    pypiDownloadsWeekly: pypi.weeklyDownloads,
  };
}

/**
 * Check if a snapshot already exists for today
 */
export async function hasSnapshotForToday(sdkId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  
  const today = new Date().toISOString().split('T')[0];
  
  const existing = await db
    .select({ id: metricsSnapshots.id })
    .from(metricsSnapshots)
    .where(
      and(
        eq(metricsSnapshots.sdkId, sdkId),
        eq(metricsSnapshots.date, today)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Save a daily snapshot to the database.
 * Only creates a new snapshot if one doesn't exist for today.
 * Returns null if snapshot already exists (to avoid unnecessary DB writes).
 */
export async function saveDailySnapshot(
  sdkId: number,
  data: SnapshotData,
  date?: Date
): Promise<{ isNew: boolean; snapshotId: number | null; skipped: boolean }> {
  const db = getDb();
  if (!db) throw new Error('Database not available');
  
  const snapshotDate = date || new Date();
  const dateString = snapshotDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if snapshot already exists for this date
  const existing = await db
    .select({ id: metricsSnapshots.id })
    .from(metricsSnapshots)
    .where(
      and(
        eq(metricsSnapshots.sdkId, sdkId),
        eq(metricsSnapshots.date, dateString)
      )
    )
    .limit(1);

  // If snapshot exists, skip - don't update (saves DB costs)
  if (existing.length > 0) {
    return { isNew: false, snapshotId: existing[0].id, skipped: true };
  }

  // Insert new snapshot
  const result = await db
    .insert(metricsSnapshots)
    .values({
      sdkId,
      date: dateString,
      githubStars: data.githubStars,
      githubForks: data.githubForks,
      githubActiveForks: data.githubActiveForks,
      githubContributors: data.githubContributors,
      githubRepeatContributors: data.githubRepeatContributors,
      githubDependentRepos: data.githubDependentRepos,
      npmDownloadsWeekly: data.npmDownloadsWeekly,
      pypiDownloadsWeekly: data.pypiDownloadsWeekly,
    })
    .returning({ id: metricsSnapshots.id });

  return { isNew: true, snapshotId: result[0].id, skipped: false };
}

/**
 * Collect and save today's snapshot (main entry point)
 * 
 * IMPORTANT: This only writes to the database ONCE per day.
 * If a snapshot already exists for today, it skips entirely
 * (no API calls, no DB writes) to minimize costs.
 */
export async function collectAndSaveSnapshot(): Promise<{
  success: boolean;
  isNew: boolean;
  skipped: boolean;
  snapshotId: number | null;
  date: string;
}> {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  
  const sdkId = await getOrCreateSDK();
  
  // Check if snapshot already exists BEFORE fetching from APIs
  // This avoids unnecessary API calls if we already have today's data
  const alreadyExists = await hasSnapshotForToday(sdkId);
  if (alreadyExists) {
    return {
      success: true,
      isNew: false,
      skipped: true,
      snapshotId: null,
      date: dateString,
    };
  }
  
  // Only fetch from APIs if we need to create a new snapshot
  const metrics = await collectCurrentMetrics();
  const { isNew, snapshotId, skipped } = await saveDailySnapshot(sdkId, metrics, today);

  return {
    success: true,
    isNew,
    skipped,
    snapshotId,
    date: dateString,
  };
}

/**
 * Get historical snapshots for the tracked repository
 */
export async function getHistoricalSnapshots(
  sdkId: number,
  days: number = 30
): Promise<typeof metricsSnapshots.$inferSelect[]> {
  const db = getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.sdkId, sdkId))
    .orderBy(desc(metricsSnapshots.date))
    .limit(days);
}

/**
 * Get the latest snapshot for the tracked repository
 */
export async function getLatestSnapshot(
  sdkId: number
): Promise<typeof metricsSnapshots.$inferSelect | null> {
  const db = getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.sdkId, sdkId))
    .orderBy(desc(metricsSnapshots.date))
    .limit(1);

  return result[0] || null;
}

export interface StoredDependentRepos {
  count: number | null;
  /** ISO date string (YYYY-MM-DD) of the snapshot that produced this count */
  date: string | null;
}

/**
 * Return the dependent repos count that the daily cron job last wrote to the
 * database, along with the snapshot date so the UI can show "updated [date]".
 *
 * This is intentionally a cheap DB read — the expensive GitHub Search API
 * call only runs once per day inside collectCurrentMetrics() (the cron job).
 * Returns { count: null, date: null } when the DB is unavailable or no
 * snapshot exists yet.
 */
export async function getStoredDependentRepos(): Promise<StoredDependentRepos> {
  try {
    const sdkId = await getOrCreateSDK();
    const snapshot = await getLatestSnapshot(sdkId);
    return {
      count: snapshot?.githubDependentRepos ?? null,
      date: snapshot?.date ?? null,
    };
  } catch {
    return { count: null, date: null };
  }
}
