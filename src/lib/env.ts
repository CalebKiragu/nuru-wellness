import "server-only";

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

const isProduction = process.env.NODE_ENV === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
  demoMode: bool(process.env.DEMO_MODE, !isProduction),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  rootDomain: (process.env.ROOT_DOMAIN ?? "localhost:3000").replace(/^https?:\/\//, "").replace(/\/$/, ""),
  sessionSecret: process.env.SESSION_SECRET || "nuru-local-development-secret-do-not-use-in-production",
  databaseUrl: process.env.DATABASE_URL,
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  openaiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  storageProvider: process.env.STORAGE_PROVIDER ?? "local",
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Nuru Wellness <notifications@example.com>",
  },
};

export function assertServerSecret() {
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  return env.sessionSecret;
}
