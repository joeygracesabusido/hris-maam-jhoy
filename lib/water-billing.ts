import prisma from '@/lib/prisma'

export interface RateTier {
  fromUnit: number
  toUnit: number | null
  pricePerUnit: number
  sequence: number
}

export function computeTieredAmount(consumption: number, tiers: RateTier[]): number {
  let total = 0
  let remaining = consumption

  const sorted = [...tiers].sort((a, b) => a.sequence - b.sequence)

  for (const tier of sorted) {
    if (remaining <= 0) break

    const tierMax = tier.toUnit ?? Infinity
    const tierRange = tierMax - tier.fromUnit
    const tierUnits = Math.min(remaining, tierRange)
    total += tierUnits * tier.pricePerUnit
    remaining -= tierUnits
  }

  return total
}

export function generateBillNo(year: number, month: number, sequence: number): string {
  const seq = String(sequence).padStart(4, '0')
  return `WTR-${year}${String(month).padStart(2, '0')}-${seq}`
}

export async function getNextBillSequence(year: number, month: number): Promise<number> {
  const prefix = `WTR-${year}${String(month).padStart(2, '0')}-`
  const lastBill = await prisma.waterBill.findFirst({
    where: { billNo: { startsWith: prefix } },
    orderBy: { billNo: 'desc' },
  })

  if (!lastBill) return 1

  const seqStr = lastBill.billNo.split('-').pop() || '0000'
  return parseInt(seqStr, 10) + 1
}

export async function getCashAccount(): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { code: '1110' },
  })
  return account?.id || ''
}

export async function getServiceIncomeAccount(): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { code: '4120' },
  })
  return account?.id || ''
}

export async function getAccountsReceivableAccount(): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { code: '1200' },
  })
  return account?.id || ''
}

export function areDatesInSameMonth(d1: Date, d2: Date): boolean {
  return d1.getUTCFullYear() === d2.getUTCFullYear() && d1.getUTCMonth() === d2.getUTCMonth()
}

export function getManilaDate(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
}
