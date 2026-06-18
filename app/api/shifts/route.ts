import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[Shifts API] Starting GET request...');
    
    // The prisma client in lib/prisma.ts now self-heals if models are missing
    const shifts = await prisma.shift.findMany();
    console.log(`[Shifts API] Successfully fetched ${shifts.length} shifts`);
    
    return NextResponse.json(shifts);
  } catch (error: unknown) {
    console.error('[Shifts API] CRITICAL ERROR:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error ? (error as { code?: string }).code : undefined;
    return NextResponse.json({
      error: 'Failed to fetch shifts',
      details: errorMessage,
      code: errorCode
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, startTime, endTime, color, isOff, gracePeriodMinutes } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'Name, startTime, and endTime are required' }, { status: 400 });
    }

    const shift = await prisma.shift.create({
      data: {
        name,
        startTime,
        endTime,
        color: color || 'bg-blue-100 border-blue-500 text-blue-700',
        isOff: isOff || false,
        gracePeriodMinutes: gracePeriodMinutes ?? 0,
      },
    });

    return NextResponse.json(shift);
  } catch (error: unknown) {
    console.error('[Shifts API] POST Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error ? (error as { code?: string }).code : undefined;
    if (errorCode === 'P2002') {
      return NextResponse.json({ error: 'A shift with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create shift', details: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, startTime, endTime, color, isOff, gracePeriodMinutes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Shift id is required' }, { status: 400 });
    }

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(color !== undefined && { color }),
        ...(isOff !== undefined && { isOff }),
        ...(gracePeriodMinutes !== undefined && { gracePeriodMinutes }),
      },
    });

    return NextResponse.json(shift);
  } catch (error: unknown) {
    console.error('[Shifts API] PATCH Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error ? (error as { code?: string }).code : undefined;
    if (errorCode === 'P2002') {
      return NextResponse.json({ error: 'A shift with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update shift', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Shift id is required' }, { status: 400 });
    }

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    await prisma.shift.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Shifts API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 });
  }
}
