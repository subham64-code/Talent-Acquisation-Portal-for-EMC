import { neon } from "@neondatabase/serverless";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

async function main() {
  const fileId = process.argv[2];
  if (!fileId) throw new Error("Pass the file id to delete.");
  const url = process.env.DATABASE_URL;
  const sql = neon(url);
  const rows = await sql.query(
    `select id, "storagePath" from emc_talent.stored_files where id = $1`,
    [fileId],
  );
  const file = rows?.[0];
  if (!file) {
    console.log("Stored file record not found:", fileId);
    return;
  }
  console.log("Deleting S3 object:", file.storagePath);
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
  await sql.query('delete from emc_talent.stored_files where id = $1', [file.id]);
  console.log("Deleted file record and object.");
}

main().catch((error) => { console.error(String((error && error.message) || error)); process.exit(1); });
