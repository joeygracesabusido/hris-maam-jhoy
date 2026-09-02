import prisma from '@/lib/prisma'

async function main(){
  const holidays = await prisma.holiday.findMany({take: 50, orderBy:{date:'asc'}})
  console.log('holidays count', holidays.length)
  console.log(JSON.stringify(holidays,null,2))
  
  const payrolls = await prisma.payroll.findMany({take: 5, orderBy:{createdAt:'desc'}})
  console.log('payrolls', JSON.stringify(payrolls,null,2))
}

main().catch(e=>{console.error(e); process.exit(1)}).finally(()=>prisma.$disconnect())
