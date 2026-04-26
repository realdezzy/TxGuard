import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze.js';
import { blinkRouter } from './routes/blink.js';
import { healthRouter } from './routes/health.js';

const app = express();
const port = parseInt(process.env['API_PORT'] ?? '3001', 10);

app.use(cors({ origin: process.env['API_CORS_ORIGIN'] ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/blink', blinkRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(port, () => {
  console.log(`Guardian API listening on port ${port}`);
});
