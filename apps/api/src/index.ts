import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze.js';
import { blinkRouter } from './routes/blink.js';
import { healthRouter } from './routes/health.js';
import { requestLogging } from './middleware/request-logging.js';
import { rateLimit } from './middleware/rate-limit.js';
import { config } from './services/config.js';
import { requestTimeout } from './middleware/timeout.js';
import { apiKeyAuth } from './middleware/api-key.js';


const app = express();

app.use(requestLogging);
app.use(cors({ origin: config.corsOriginList }));
app.use(express.json({ limit: config.requestBodyLimit }));
app.use(requestTimeout(config.requestTimeoutMs));

app.use('/api/health', healthRouter);
app.use(
  '/api/analyze',
  apiKeyAuth(config),
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  }),
  analyzeRouter,
);
app.use(
  '/api/blink',
  apiKeyAuth(config),
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  }),
  blinkRouter,
);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const requestId = (_req as any).id ?? 'unknown';
    const message = err.message ?? 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'internal_error', message }));
    res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(config.port, () => {
  console.log(`Guardian API listening on port ${config.port}`);
});
