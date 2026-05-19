import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const employees = await prisma.employee.findMany({ select: { fullName: true } });
  console.log(employees.map(e => e.fullName).join('\n'));
}
main().catch(console.error);
