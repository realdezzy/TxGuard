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
  trustedBlinkDomains: z.string().min(1).optional(),
  trustedMarketPrograms: z.string().min(1).optional(),
});

export type ApiConfig = z.infer<typeof configSchema> & {
  corsOriginList: string[];
  trustedBlinkDomainsList: string[];
  trustedMarketProgramsList: string[];
};

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
    trustedBlinkDomains: env['API_TRUSTED_BLINK_DOMAINS'],
    trustedMarketPrograms: env['API_TRUSTED_MARKET_PROGRAMS'],
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API configuration: ${details}`);
  }

  const config = result.data;

  if (config.nodeEnv === 'production') {
    const origins = config.corsOrigin.includes(',')
      ? config.corsOrigin.split(',').map(s => s.trim())
      : [config.corsOrigin];
    const hasLocalhost = origins.some((origin) =>
      LOCALHOST_ORIGINS.some((prefix) => origin.startsWith(prefix)),
    );
    if (hasLocalhost) {
      throw new Error(
        'Production configuration error: API_CORS_ORIGIN must not contain localhost addresses in production.',
      );
    }
    if (!config.apiKey) {
      throw new Error(
        'Production configuration error: API_KEY is required in production.',
      );
    }
    if (config.apiKey.length < 16) {
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
    trustedBlinkDomainsList: config.trustedBlinkDomains
      ? config.trustedBlinkDomains.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [],
    trustedMarketProgramsList: config.trustedMarketPrograms
      ? config.trustedMarketPrograms.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [],
  };
}

export const config = loadConfig();
