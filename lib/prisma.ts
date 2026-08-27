import { PrismaClient } from "@prisma/client"

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

declare const globalThis: {
  prismaGlobal: PrismaClient | undefined
} & typeof global

const getPrisma = () => {
  if (process.env.NODE_ENV === "production") {
    return prismaClientSingleton()
  }

  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = prismaClientSingleton()
  }

  return globalThis.prismaGlobal
}

const prisma = getPrisma()

export default prisma
