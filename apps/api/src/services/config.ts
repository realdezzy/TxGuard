import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.string().default('development'),
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  corsOrigin: z.string().min(1).default('http://localhost:5173'),
  solanaRpcUrl: z.string().url().default('https://api.devnet.solana.com'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  requestBodyLimit: z.string().min(1).default('1mb'),
  rateLimitWindowMs: z.coerce.number().int().positive().default(60_000),
  rateLimitPerIpMaxRequests: z.coerce.number().int().positive().default(60),
  rateLimitPerKeyMaxRequests: z.coerce.number().int().positive().default(600),
  requestTimeoutMs: z.coerce.number().int().positive().default(30_000),
  apiKey: z.string().min(1).optional(),
});

export type ApiConfig = z.infer<typeof configSchema> & { corsOriginList: string[] };

const LOCALHOST_ORIGINS = ['http://localhost', 'http://127.0.0.1'];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const result = configSchema.safeParse({
    nodeEnv: env['NODE_ENV'],
    port: env['API_PORT'],
    corsOrigin: env['API_CORS_ORIGIN'],
    solanaRpcUrl: env['SOLANA_RPC_URL'],
    redisUrl: env['REDIS_URL'],
    requestBodyLimit: env['API_REQUEST_BODY_LIMIT'],
    rateLimitWindowMs: env['API_RATE_LIMIT_WINDOW_MS'],
    rateLimitPerIpMaxRequests: env['API_RATE_LIMIT_PER_IP_MAX_REQUESTS'],
    rateLimitPerKeyMaxRequests: env['API_RATE_LIMIT_PER_KEY_MAX_REQUESTS'],
    requestTimeoutMs: env['API_REQUEST_TIMEOUT_MS'],
    apiKey: env['API_KEY'],
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API configuration: ${details}`);
  }

  const config = result.data;

  if (config.nodeEnv === 'production') {
    const isLocalhost = LOCALHOST_ORIGINS.some((prefix) =>
      config.corsOrigin.startsWith(prefix),
    );
    if (isLocalhost) {
      throw new Error(
        'Production configuration error: API_CORS_ORIGIN must not be a localhost address in production.',
      );
    }
    if (config.apiKey && config.apiKey.length < 16) {
      throw new Error(
        'Production configuration error: API_KEY must be at least 16 characters.',
      );
    }
  }

  return {
    ...config,
    corsOriginList: config.corsOrigin.includes(',')
      ? config.corsOrigin.split(',').map(s => s.trim())
      : [config.corsOrigin],
  };
}

export const config = loadConfig();
