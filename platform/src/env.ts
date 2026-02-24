// Environment variable schema + validation

export type PlatformEnv = {
  DATABASE_URL: string;
  GATEWAY_URL: string;
  GATEWAY_TOKEN: string;
  PLATFORM_ENCRYPTION_KEY: string;
  BETTER_AUTH_SECRET: string;
  PLATFORM_PORT: number;
  PLATFORM_SHARED_ANTHROPIC_KEY: string | null;
  PLATFORM_SHARED_OPENAI_KEY: string | null;
};

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

export function loadEnv(): PlatformEnv {
  const encryptionKey = required("PLATFORM_ENCRYPTION_KEY");
  if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
    throw new Error("PLATFORM_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }

  return {
    DATABASE_URL: required("DATABASE_URL"),
    GATEWAY_URL: required("GATEWAY_URL"),
    GATEWAY_TOKEN: required("GATEWAY_TOKEN"),
    PLATFORM_ENCRYPTION_KEY: encryptionKey,
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
    PLATFORM_PORT: Number(process.env.PLATFORM_PORT) || 3000,
    PLATFORM_SHARED_ANTHROPIC_KEY: process.env.PLATFORM_SHARED_ANTHROPIC_KEY ?? null,
    PLATFORM_SHARED_OPENAI_KEY: process.env.PLATFORM_SHARED_OPENAI_KEY ?? null,
  };
}
