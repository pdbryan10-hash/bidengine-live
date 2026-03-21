import { NextResponse } from 'next/server';

// Auth disabled — test mode, all requests pass through
export async function requireAuth(): Promise<{ userId: string } | { error: NextResponse }> {
  return { userId: 'test-user' };
}

export async function requireAdmin(): Promise<{ userId: string } | { error: NextResponse }> {
  return { userId: 'test-user' };
}
