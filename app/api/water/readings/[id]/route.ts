import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const existing = await prisma.waterMeterReading.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Reading not found' }, { status: 404 })
    }

    const currentReading = body.currentReading ?? existing.currentReading
    const previousReading = body.previousReading ?? existing.previousReading

    if (currentReading < previousReading) {
      return NextResponse.json(
        { error: `Current reading (${currentReading}) cannot be less than previous reading (${previousReading})` },
        { status: 400 }
      )
    }

    const reading = await prisma.waterMeterReading.update({
      where: { id: params.id },
      data: {
        readingDate: body.readingDate ? new Date(body.readingDate) : undefined,
        previousReading: body.previousReading,
        currentReading: body.currentReading,
        consumption: currentReading - previousReading,
        source: body.source,
        isEstimated: body.isEstimated,
        notes: body.notes,
      },
    })

    return NextResponse.json(reading)
  } catch (error) {
    console.error('Error updating reading:', error)
    return NextResponse.json({ error: 'Failed to update reading' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const billCount = await prisma.waterBill.count({
      where: { readingId: params.id },
    })

    if (billCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete reading linked to a bill. Remove the bill first.' },
        { status: 400 }
      )
    }

    await prisma.waterMeterReading.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reading:', error)
    return NextResponse.json({ error: 'Failed to delete reading' }, { status: 500 })
  }
}
