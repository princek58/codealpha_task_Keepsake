require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const storage = require('./services/storage');
const mediaQueue = require('./services/media/queue');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');

    await storage.cleanTmp();
    await mediaQueue.recoverDanglingProcessing();

    const server = app.listen(PORT, () => {
      console.log(`Keepsake server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
    return server;
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
