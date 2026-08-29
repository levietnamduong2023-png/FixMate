import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { observability } from './middleware/observability.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import complaintRoutes from './routes/complaints.js';
import notificationRoutes from './routes/notifications.js';
import { addressRouter, profileRouter } from './routes/profile.js';
import publicRoutes from './routes/public.js';
import requestRoutes from './routes/requests.js';
import technicianRoutes from './routes/technicians.js';
import webhookRoutes from './routes/webhooks.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDist = resolve(currentDirectory, '../../FE/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin không được phép.'));
    },
    credentials: true,
  }));
  app.use(observability);
  app.use(express.json({
    limit: '1mb',
    verify(request, _response, buffer) {
      request.rawBody = buffer.toString('utf8');
    },
  }));

  app.get('/api/health', (_request, response) => {
    const ready = mongoose.connection.readyState === 1;
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      service: 'fixmate-api',
      version: '0.3.0',
      database: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      time: new Date().toISOString(),
    });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' } },
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/technicians', technicianRoutes);
  app.use('/api', publicRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/profile', profileRouter);
  app.use('/api/addresses', addressRouter);
  app.use('/api/admin', adminRoutes);

  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { maxAge: config.nodeEnv === 'production' ? '1d' : 0 }));
    app.use((request, response, next) => {
      if (request.path.startsWith('/api/')) return next();
      return response.sendFile(resolve(frontendDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
