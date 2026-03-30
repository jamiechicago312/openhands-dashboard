import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sdks, metricsSnapshots } from '@/lib/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { SDK_CONFIG } from '@/lib/sdk-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get('period') || '30', 10);
    const sdkRepo = searchParams.get('sdk'); // Optional: owner/repo format

    // Validate period
    const validPeriods = [7, 30, 90, 180, 365];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: `Invalid period. Valid values: ${validPeriods.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // If database is not available, return empty data
    if (!db) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      return NextResponse.json({
        period,
        data: {
          githubStars: [],
          githubForks: [],
          githubActiveForks: [],
          pypiDownloads: [],
        },
        snapshotCount: 0,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        message: 'Database not available. Please configure DATABASE_URL.',
      });
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    let sdkId: number | undefined;

    // If sdk parameter is provided, look up the SDK
    if (sdkRepo) {
      const [owner, repo] = sdkRepo.split('/');
      if (owner && repo) {
        try {
          const sdk = await db
            .select()
            .from(sdks)
            .where(eq(sdks.githubRepo, `${owner}/${repo}`))
            .limit(1);
          
          if (sdk.length > 0) {
            sdkId = sdk[0].id;
          }
        } catch (dbError) {
          console.error('Database query error:', dbError);
          // Return empty data if DB query fails
          return NextResponse.json({
            period,
            data: {
              githubStars: [],
              githubForks: [],
              githubActiveForks: [],
              pypiDownloads: [],
            },
            snapshotCount: 0,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            message: 'Database unavailable or empty.',
          });
        }
      }
    } else {
      // Default: Look up the SDK from SDK_CONFIG
      const defaultSdkRepo = `${SDK_CONFIG.github.owner}/${SDK_CONFIG.github.repo}`;
      try {
        const sdk = await db
          .select()
          .from(sdks)
          .where(eq(sdks.githubRepo, defaultSdkRepo))
          .limit(1);
        
        if (sdk.length > 0) {
          sdkId = sdk[0].id;
        }
      } catch (dbError) {
        console.error('Database query error:', dbError);
        // Return empty data if DB query fails
        return NextResponse.json({
          period,
          data: {
            githubStars: [],
            githubForks: [],
            githubActiveForks: [],
            pypiDownloads: [],
          },
          snapshotCount: 0,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          message: 'Database unavailable or empty.',
        });
      }
    }

    // If no SDK found, return empty data
    if (!sdkId) {
      return NextResponse.json({
        period,
        data: {
          githubStars: [],
          githubForks: [],
          githubActiveForks: [],
          pypiDownloads: [],
        },
        snapshotCount: 0,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        message: 'No tracked repository found in the database. Run the cron job to collect the initial snapshot.',
      });
    }

    // Build query with all conditions
    const snapshots = await db
      .select()
      .from(metricsSnapshots)
      .where(
        and(
          eq(metricsSnapshots.sdkId, sdkId),
          gte(metricsSnapshots.date, startDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(metricsSnapshots.date));

    // Transform data for charts
    const starsData = snapshots.map((s) => ({
      date: s.date,
      value: s.githubStars,
    }));

    const forksData = snapshots.map((s) => ({
      date: s.date,
      value: s.githubForks,
    }));

    const activeForksData = snapshots.map((s) => ({
      date: s.date,
      value: s.githubActiveForks,
    }));

    const pypiData = snapshots.map((s) => ({
      date: s.date,
      value: s.pypiDownloadsWeekly,
    }));

    return NextResponse.json({
      period,
      data: {
        githubStars: starsData,
        githubForks: forksData,
        githubActiveForks: activeForksData,
        pypiDownloads: pypiData,
      },
      snapshotCount: snapshots.length,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Failed to fetch historical data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}
