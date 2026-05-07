import { describe, it, expect, beforeEach } from 'vitest';

const LOCALHOST_ORIGINS = ['http://localhost', 'http://127.0.0.1'];

function loadConfig(env: Record<string, string | undefined>) {
  const configSchema = {
    corsOrigin: env['API_CORS_ORIGIN'] ?? 'http://localhost:5173',
    nodeEnv: env['NODE_ENV'] ?? 'development',
    port: Number(env['API_PORT'] ?? '3001'),
    apiKey: env['API_KEY'],
  };

  if (configSchema.nodeEnv === 'production') {
    const origins = configSchema.corsOrigin.includes(',')
      ? configSchema.corsOrigin.split(',').map((s: string) => s.trim())
      : [configSchema.corsOrigin];
    const hasLocalhost = origins.some((origin: string) =>
      LOCALHOST_ORIGINS.some((prefix) => origin.startsWith(prefix)),
    );
    if (hasLocalhost) {
      throw new Error(
        'Production configuration error: API_CORS_ORIGIN must not contain localhost addresses in production.',
      );
    }
    if (!configSchema.apiKey) {
      throw new Error('Production configuration error: API_KEY is required in production.');
    }
    if (configSchema.apiKey.length < 16) {
      throw new Error('Production configuration error: API_KEY must be at least 16 characters.');
    }
  }

  return {
    ...configSchema,
    corsOriginList: configSchema.corsOrigin.includes(',')
      ? configSchema.corsOrigin.split(',').map((s: string) => s.trim())
      : [configSchema.corsOrigin],
  };
}

describe('config validation', () => {
  describe('development mode', () => {
    it('allows localhost origins', () => {
      const config = loadConfig({
        NODE_ENV: 'development',
        API_CORS_ORIGIN: 'http://localhost:3000',
      });
      expect(config.corsOriginList).toEqual(['http://localhost:3000']);
    });

    it('allows 127.0.0.1 origins', () => {
      const config = loadConfig({
        NODE_ENV: 'development',
        API_CORS_ORIGIN: 'http://127.0.0.1:5173',
      });
      expect(config.corsOriginList).toEqual(['http://127.0.0.1:5173']);
    });

    it('does not require API key', () => {
      expect(() =>
        loadConfig({ NODE_ENV: 'development' }),
      ).not.toThrow();
    });
  });

  describe('production mode', () => {
    it('rejects a single localhost origin', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'http://localhost:3000',
          API_KEY: 'a'.repeat(16),
        }),
      ).toThrow('must not contain localhost');
    });

    it('rejects 127.0.0.1 origin', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'http://127.0.0.1:5173',
          API_KEY: 'a'.repeat(16),
        }),
      ).toThrow('must not contain localhost');
    });

    it('rejects comma-separated origins with localhost', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'https://app.example.com,http://localhost:3000',
          API_KEY: 'a'.repeat(16),
        }),
      ).toThrow('must not contain localhost');
    });

    it('rejects comma-separated origins with localhost as first element', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'http://localhost:5173,https://app.example.com',
          API_KEY: 'a'.repeat(16),
        }),
      ).toThrow('must not contain localhost');
    });

    it('accepts production-safe origins', () => {
      const config = loadConfig({
        NODE_ENV: 'production',
        API_CORS_ORIGIN: 'https://app.example.com',
        API_KEY: 'a'.repeat(16),
      });
      expect(config.corsOriginList).toEqual(['https://app.example.com']);
    });

    it('accepts multiple production-safe origins', () => {
      const config = loadConfig({
        NODE_ENV: 'production',
        API_CORS_ORIGIN: 'https://app.example.com,https://admin.example.com',
        API_KEY: 'a'.repeat(16),
      });
      expect(config.corsOriginList).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
    });

    it('rejects missing API key', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'https://app.example.com',
        }),
      ).toThrow('API_KEY is required');
    });

    it('rejects short API key', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'https://app.example.com',
          API_KEY: 'short',
        }),
      ).toThrow('API_KEY must be at least 16');
    });
  });

  describe('corsOriginList parsing', () => {
    it('handles single origin without commas', () => {
      const config = loadConfig({
        NODE_ENV: 'development',
        API_CORS_ORIGIN: 'https://example.com',
      });
      expect(config.corsOriginList).toEqual(['https://example.com']);
    });

    it('handles comma-separated origins with whitespace', () => {
      const config = loadConfig({
        NODE_ENV: 'development',
        API_CORS_ORIGIN: 'https://a.com, https://b.com ,https://c.com',
      });
      expect(config.corsOriginList).toEqual([
        'https://a.com',
        'https://b.com',
        'https://c.com',
      ]);
    });
  });
});
