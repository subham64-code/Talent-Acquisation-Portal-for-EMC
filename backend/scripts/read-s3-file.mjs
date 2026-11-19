import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? "auto", credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }, forcePathStyle: true });
const res = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: process.argv[2] }));
const buf = Buffer.from(await res.Body.transformToByteArray());
console.log("bytes", buf.length);
console.log(buf.toString("utf8", 0, Math.min(400, buf.length)));
console.log("end", buf.toString("utf8", Math.max(0, buf.length - 100)));
