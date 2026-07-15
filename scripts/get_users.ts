import { prisma } from '../src/lib/db'

async function main() {
  const users = await prisma.user.findMany()
  console.log("Users:", users.map(u => u.email))
}
main().finally(() => process.exit(0))
