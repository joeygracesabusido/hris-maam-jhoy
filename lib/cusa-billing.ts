import prisma from '@/lib/prisma'

export interface CusaRateTier {
  fromArea: number
  toArea: number | null
  pricePerSqm: number
  sequence: number
}

export function findApplicableTier(areaSqm: number, tiers: CusaRateTier[]): CusaRateTier | null {
  if (areaSqm < 0) throw new Error('Area must be non-negative')
  
  const sorted = [...tiers].sort((a, b) => a.sequence - b.sequence)
  
  for (const tier of sorted) {
    const tierMax = tier.toArea ?? Infinity
    if (areaSqm >= tier.fromArea && areaSqm <= tierMax) {
      return tier
    }
  }
  
  return null
}

export function computeCusaAmount(areaSqm: number, pricePerSqm: number, months: number = 3): number {
  if (areaSqm < 0) throw new Error('Area must be non-negative')
  if (pricePerSqm < 0) throw new Error('Price per sq.m. must be non-negative')
  if (months < 1 || months > 3) throw new Error('Months must be 1-3')
  return Math.round(areaSqm * pricePerSqm * months * 100) / 100
}

export function generateCusaBillNo(year: number, quarter: number, sequence: number): string {
  const seq = String(sequence).padStart(4, '0')
  return `CUSA-${year}Q${quarter}-${seq}`
}

export async function getNextCusaBillSequence(year: number, quarter: number): Promise<number> {
  const prefix = `CUSA-${year}Q${quarter}-`
  const lastBill = await prisma.cusaBill.findFirst({
    where: { billNo: { startsWith: prefix } },
    orderBy: { billNo: 'desc' },
  })

  if (!lastBill) return 1

  const seqStr = lastBill.billNo.split('-').pop() || '0000'
  return parseInt(seqStr, 10) + 1
}

export function generateCusaPaymentNo(date: Date, sequence: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(sequence).padStart(4, '0')
  return `CUSAPAY-${dateStr}-${seq}`
}

export async function getNextCusaPaymentSequence(date: Date): Promise<number> {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `CUSAPAY-${dateStr}-`
  const lastPayment = await prisma.cusaPayment.findFirst({
    where: { paymentNo: { startsWith: prefix } },
    orderBy: { paymentNo: 'desc' },
  })

  if (!lastPayment) return 1

  const seqStr = lastPayment.paymentNo.split('-').pop() || '0000'
  return parseInt(seqStr, 10) + 1
}

export function getQuarterDates(quarter: number, year: number): { start: Date; end: Date } {
  if (quarter < 1 || quarter > 4) throw new Error('Quarter must be 1-4')
  
  const quarterStarts = [0, 0, 3, 6, 9] // Q1=January(0), Q2=April(3), Q3=July(6), Q4=October(9)
  const month = quarterStarts[quarter]
  
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 3, 0)) // Last day of quarter
  
  return { start, end }
}

export function getManilaDate(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
}