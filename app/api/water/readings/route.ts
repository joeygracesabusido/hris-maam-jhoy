import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const meterId = searchParams.get('meterId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (meterId) where.meterId = meterId

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.readingDate = dateFilter
    }

    const readings = await prisma.waterMeterReading.findMany({
      where,
      include: {
        meter: {
          include: { tenant: true },
        },
      },
      orderBy: { readingDate: 'desc' },
    })

    return NextResponse.json(readings)
  } catch (error) {
    console.error('Error fetching readings:', error)
    return NextResponse.json({ error: 'Failed to fetch readings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { meterId, readingDate, currentReading, source, isEstimated, notes } = body

    if (!meterId || readingDate === undefined || currentReading === undefined) {
      return NextResponse.json({ error: 'Meter ID, reading date, and current reading are required' }, { status: 400 })
    }

    const lastReading = await prisma.waterMeterReading.findFirst({
      where: { meterId },
      orderBy: { readingDate: 'desc' },
    })

    const previousReading = lastReading?.currentReading ?? 0

    if (currentReading < previousReading) {
      return NextResponse.json(
        { error: `Current reading (${currentReading}) cannot be less than previous reading (${previousReading})` },
        { status: 400 }
      )
    }

    const reading = await prisma.waterMeterReading.create({
      data: {
        meterId,
        readingDate: new Date(readingDate),
        previousReading,
        currentReading,
        consumption: currentReading - previousReading,
        source: source || 'MANUAL',
        isEstimated: isEstimated || false,
        notes,
      },
    })

    return NextResponse.json(reading, { status: 201 })
  } catch (error) {
    console.error('Error creating reading:', error)
    return NextResponse.json({ error: 'Failed to create reading' }, { status: 500 })
  }
}
