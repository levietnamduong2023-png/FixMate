import mongoose from 'mongoose';
import { app } from './app.js';
import { config, validateProductionConfig } from './config.js';

validateProductionConfig();

await mongoose.connect(config.mongoUri, {
  serverSelectionTimeoutMS: 10_000,
  maxPoolSize: 20,
});

const server = app.listen(config.port, config.host, () => {
  console.log(`FixMate API đang chạy tại http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal}: đang dừng FixMate...`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

