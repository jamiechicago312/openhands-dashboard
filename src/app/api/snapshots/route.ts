import { NextResponse } from 'next/server';
import { collectAndSaveSnapshot, getOrCreateSDK, getHistoricalSnapshots } from '@/lib/snapshots';

// Force dynamic rendering (no prerendering at build time)
export const dynamic = 'force-dynamic';

/**
 * GET /api/snapshots - Get historical snapshots
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const sdkId = await getOrCreateSDK();
    const snapshots = await getHistoricalSnapshots(sdkId, days);

    return NextResponse.json({
      success: true,
      count: snapshots.length,
      snapshots,
    });
  } catch (error) {
    console.error('Failed to fetch snapshots:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/snapshots - Collect and save a new snapshot
 * 
 * This should only be called once per day (by cron job).
 * If a snapshot already exists for today, it SKIPS entirely
 * (no API calls to GitHub/PyPI, no DB writes) to minimize costs.
 */
export async function POST() {
  try {
    const result = await collectAndSaveSnapshot();

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        message: `Snapshot already exists for ${result.date} - skipped`,
        date: result.date,
        skipped: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `New snapshot created for ${result.date}`,
      snapshotId: result.snapshotId,
      date: result.date,
      skipped: false,
    });
  } catch (error) {
    console.error('Failed to save snapshot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save snapshot' },
      { status: 500 }
    );
  }
}
