const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const connectTestDB = async () => {
  if (!process.__TEST_MONGO_SERVER__) {
    process.__TEST_MONGO_SERVER__ = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 }
    });
  }
  const uri = process.__TEST_MONGO_SERVER__.getUri();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
};

const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

const closeTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

module.exports = {
  connectTestDB,
  clearTestDB,
  closeTestDB
};

