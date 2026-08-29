import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

export function observability(request, response, next) {
  const startedAt = process.hrtime.bigint();
  request.id = String(request.get('x-request-id') || randomUUID()).slice(0, 100);
  response.set('X-Request-Id', request.id);
  response.on('finish', () => {
    const runningTests = process.argv.some((argument) => argument.endsWith('.test.js'));
    if (!config.requestLogEnabled || config.nodeEnv === 'test' || runningTests) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: response.statusCode >= 500 ? 'error' : 'info',
      service: 'fixmate-api',
      requestId: request.id,
      method: request.method,
      route: request.route?.path || request.path,
      status: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    }));
  });
  next();
}
