import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

let client: S3Client | null = null;

const getR2Client = () => {
  if (client) return client;

  client = new S3Client({
    region: "auto",
    endpoint: requiredEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  return client;
};

export const getR2BucketName = () => requiredEnv("R2_BUCKET_NAME");

export const buildR2PublicUrl = (path: string) => {
  const baseUrl = requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
};

export async function uploadR2Object({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

export async function deleteR2Object(key: string) {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
    })
  );
}
