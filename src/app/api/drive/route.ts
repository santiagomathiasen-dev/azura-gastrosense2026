import { NextResponse } from 'next/server';

// Google Drive integration is permanently disabled.
// All data operations go through Supabase directly.

export async function GET() {
  return NextResponse.json(
    { error: 'Google Drive integration is disabled. Use Supabase.' },
    { status: 503 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Google Drive integration is disabled. Use Supabase.' },
    { status: 503 }
  );
}
