import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL, schema: "emc_talent" }) });
  const candidates = await prisma.employee.findMany({ where: { fullName: "EMC Test Invitation" }, include: { invitations: true } });
  console.log("found test employees:", candidates.length);
  for (const employee of candidates) {
    await prisma.employee.delete({ where: { id: employee.id } });
    console.log("deleted", employee.id);
  }
  await prisma.$disconnect();
}

main().catch((error) => { console.error(String(error?.message ?? error)); process.exit(1); });
