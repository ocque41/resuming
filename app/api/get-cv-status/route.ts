import { NextResponse } from 'next/server';
import { getCVByFileName } from '@/lib/db/queries.server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');
  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName parameter' }, { status: 400 });
  }

  const cvRecord = await getCVByFileName(fileName);
  if (!cvRecord) {
    return NextResponse.json({ error: 'CV not found' }, { status: 404 });
  }

  const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
  return NextResponse.json(metadata);
}
