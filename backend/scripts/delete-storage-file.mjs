import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

async function main() {
  const fileId = process.argv[2];
  if (!fileId) {
    console.error("Pass the StoredFile id to delete.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL, schema: "emc_talent" }) });
  try {
    const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!file) {
      console.log("Stored file record already gone:", fileId);
      return;
    }
    console.log("Deleting file object from storage:", file.id, file.storagePath);
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? process.env.FILEBASE_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: file.storagePath }));
    await prisma.storedFile.delete({ where: { id: file.id } }).catch((error) => {
      console.log("File object deleted; DB record could not be removed (may be referenced):", String(error?.message ?? error).split("\n")[0]);
    });
    console.log("Storage file deleted");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(String((error && error.message) || error));
  process.exit(1);
});
