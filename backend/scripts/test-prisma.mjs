import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  const tests = [
    ["employee relation", () => prisma.employeeUpdateInvitation.findMany({ take: 1, include: { employee: true } })],
    ["reminders relation", () => prisma.employeeInviteReminder.findMany({ take: 1 })],
    ["plain invitation", () => prisma.employeeUpdateInvitation.findMany({ take: 1 })],
  ];
  for (const [label, fn] of tests) {
    try {
      const r = await fn();
      console.log("OK", label, r.length);
    } catch (error) {
      console.error("ERR", label, String((error && error.message) || error).split("\n")[0]);
    }
  }
  await prisma.$disconnect();
}

main();
