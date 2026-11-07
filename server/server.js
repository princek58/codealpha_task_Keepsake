require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');
const storage = require('./services/storage');
const mediaQueue = require('./services/media/queue');
const { reconcileStorage } = require('./services/reconcileStorage');
const { restoreDemoBundle } = require('./services/demoBundle');

let serverInstance = null;

const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');

    // Storage reconciliation if enabled
    if (config.reconcileStorageOnBoot) {
      try {
        await reconcileStorage();
      } catch (err) {
        console.error('Storage reconciliation failed:', err.message);
      }
    }

    // Demo bundle restore if enabled
    if (config.demoMode && config.seedDemoOnBoot) {
      try {
        await restoreDemoBundle();
        if (app.setDemoReady) app.setDemoReady(true);
      } catch (err) {
        console.error('Demo bundle restore failed:', err.message);
      }
    } else {
      if (app.setDemoReady) app.setDemoReady(true);
    }

    await storage.cleanTmp();
    await mediaQueue.recoverDanglingProcessing();

    serverInstance = app.listen(config.port, '0.0.0.0', () => {
      console.log(`Keepsake server running on port ${config.port} (0.0.0.0) in ${config.env} mode`);
    });

    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      if (serverInstance) {
        serverInstance.close(async () => {
          try {
            await mongoose.connection.close(false);
            console.log('Keepsake shut down cleanly.');
            process.exit(0);
          } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
          }
        });

        setTimeout(() => {
          console.error('Forced shutdown due to timeout.');
          process.exit(1);
        }, 10000).unref();
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return serverInstance;
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
