import mongoose from 'mongoose';
import { app } from './app.js';
import { config, validateProductionConfig } from './config.js';
import { runMaintenanceJobs } from './services/jobs.js';
import { processOutboxBatch } from './services/outbox.js';

validateProductionConfig();

await mongoose.connect(config.mongoUri, {
  serverSelectionTimeoutMS: 10_000,
  maxPoolSize: 20,
});

const server = app.listen(config.port, config.host, () => {
  console.log(`FixMate API đang chạy tại http://${config.host}:${config.port}`);
});

const outboxTimer = setInterval(() => {
  processOutboxBatch().catch((error) => console.error(JSON.stringify({
    level: 'error',
    event: 'outbox_worker_failed',
    message: error.message,
  })));
}, 5_000);
const maintenanceTimer = setInterval(() => {
  runMaintenanceJobs().catch((error) => console.error(JSON.stringify({
    level: 'error',
    event: 'maintenance_job_failed',
    message: error.message,
  })));
}, 60_000);
outboxTimer.unref();
maintenanceTimer.unref();

async function shutdown(signal) {
  console.log(signal + ': đang dừng FixMate...');
  clearInterval(outboxTimer);
  clearInterval(maintenanceTimer);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
