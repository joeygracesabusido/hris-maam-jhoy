import prisma from '@/lib/prisma'
import { computePayroll } from '@/lib/payroll'

async function main(){
  const startDate = new Date(2026, 7, 16, 0,0,0)
  const endDate = new Date(2026, 7, 31, 0,0,0)
  const nextDay = new Date(endDate.getTime() + 86400000)
  console.log('period', startDate.toISOString(), 'to', endDate.toISOString(), 'nextDay', nextDay.toISOString())

  const holidaysAll = await prisma.holiday.findMany({ where: { isActive:true, date:{ gte:startDate, lt: nextDay } } })
  console.log('holidays with FIX (no branch filter):', holidaysAll.map(h=>({name:h.name, date:h.date.toISOString().split('T')[0], branchId:h.branchId, type:h.type})))

  const holidaysOld = await prisma.holiday.findMany({ where: { isActive:true, branchId:null, date:{ gte:startDate, lt: nextDay } } })
  console.log('holidays OLD filter (branchId null only):', holidaysOld.map(h=>({name:h.name, date:h.date.toISOString().split('T')[0], type:h.type})))

  const employee = await prisma.employee.findFirst()
  if(!employee) { console.log('no employee'); return }
  console.log('employee', employee.fullName, employee.dailyRate, employee.payType)

  const timeLogs = await prisma.timeLog.findMany({ where:{ employeeId:employee.id, date:{ gte:startDate, lt: nextDay } } })
  console.log('timeLogs count', timeLogs.length)

  const leaves = await prisma.leaveRequest.findMany({ where:{ employeeId:employee.id, status:'APPROVED', startDate:{lte:endDate}, endDate:{gte:startDate} } })
  const shiftSchedules = await prisma.shiftSchedule.findMany({ where:{ employeeId:employee.id, date:{ gte:startDate, lt: nextDay } }, include:{shift:true}})

  const resultOld = computePayroll({
    employee:{...employee, payrollDivisor: employee.payrollDivisor||26},
    timeLogs: timeLogs.map(log=>({...log, date:new Date(log.date), clockIn: log.clockIn?new Date(log.clockIn):null, clockOut: log.clockOut?new Date(log.clockOut):null})),
    leaves: leaves.map(l=>({daysCount:l.daysCount})),
    shiftSchedules: shiftSchedules.map(s=>({shift:s.shift})),
    holidays: holidaysOld,
    period:{startDate, endDate, frequency:'SEMIMONTHLY' as any},
    deductionsFlags:{sss:false, philhealth:false, pagibig:false, tax:false},
    adjustments:{add:0, deduct:0}
  })
  console.log('OLD holidayPay', resultOld.holidayPay, 'regular', resultOld.regularHolidayDays, 'special', resultOld.specialHolidayDays, 'holidayDays', resultOld.holidayDays)

  const resultNew = computePayroll({
    employee:{...employee, payrollDivisor: employee.payrollDivisor||26},
    timeLogs: timeLogs.map(log=>({...log, date:new Date(log.date), clockIn: log.clockIn?new Date(log.clockIn):null, clockOut: log.clockOut?new Date(log.clockOut):null})),
    leaves: leaves.map(l=>({daysCount:l.daysCount})),
    shiftSchedules: shiftSchedules.map(s=>({shift:s.shift})),
    holidays: holidaysAll,
    period:{startDate, endDate, frequency:'SEMIMONTHLY' as any},
    deductionsFlags:{sss:false, philhealth:false, pagibig:false, tax:false},
    adjustments:{add:0, deduct:0}
  })
  console.log('NEW holidayPay', resultNew.holidayPay, 'regular', resultNew.regularHolidayDays, 'special', resultNew.specialHolidayDays, 'holidayDays', resultNew.holidayDays, 'gross', resultNew.grossEarnings)

  if(resultNew.holidayPay>0 && resultOld.holidayPay===0){
    console.log('VERIFIED: fix correctly includes branch holidays that were previously missed')
  } else {
    console.log('UNEXPECTED: check values')
  }
}

main().catch(e=>{console.error(e); process.exit(1)}).finally(()=>prisma.$disconnect())
