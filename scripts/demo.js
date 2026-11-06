// Keepsake Zero-Setup Demo Runner
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server/app');
const config = require('../server/config');
const { runSeed, DEMO_USERS, DEMO_PASSWORD } = require('./seed');

let mongod = null;
let server = null;
let isShuttingDown = false;

async function startDemo() {
  console.log('\n======================================================');
  console.log('              STARTING KEEPSAKE DEMO                  ');
  console.log('======================================================\n');

  let mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || process.argv.includes('--memory') || process.argv.includes('--in-memory')) {
    console.log('Starting in-memory MongoDB server (mongodb-memory-server)...');
    try {
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.log('In-memory MongoDB initialized successfully.');
    } catch (err) {
      console.warn('Could not launch in-memory MongoDB, falling back to configured URI:', err.message);
      mongoUri = config.mongodbUri;
    }
  }

  process.env.MONGODB_URI = mongoUri;

  console.log('Connecting Mongoose to database...');
  await mongoose.connect(mongoUri);

  console.log('Seeding initial demo dataset...');
  await runSeed({ keepConnection: true, mongodbUri: mongoUri });

  let port = Number(process.env.DEMO_PORT || process.env.PORT || 5000);
  
  function tryListen(p) {
    server = app.listen(p, () => {
      printBanner(p);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${p} is in use, trying port ${p + 1}...`);
        tryListen(p + 1);
      } else {
        throw err;
      }
    });
  }

  tryListen(port);

  setupShutdownHooks();
}

function printBanner(port) {
  const url = `http://localhost:${port}`;
  const banner = `
========================================================================
                      K E E P S A K E
          A Calm, Photo-First Memory-Keeping Web App
========================================================================

  Application Running At:
  --> ${url}

  Demo Accounts (Password for all: ${DEMO_PASSWORD})
  -------------------------------------------------------------
  • @clara   — Clara Dubois     (Film stories, curated albums, Paris)
  • @daisy   — Daisy Miller     (Quiet morning coffee, tea & ocean)
  • @leo     — Leo Sterling     (Train journeys across Hokkaido, snapshots)
  • @maya    — Maya Lindqvist   (Nordic landscapes, sourdough baking)

  Quick Direct Links:
  -------------------------------------------------------------
  • Landing / Welcome:       ${url}/
  • Home Feed:               ${url}/home.html
  • Media Library:           ${url}/library.html
  • Create New Moment:       ${url}/moment-new.html
  • Albums Collection:       ${url}/albums.html
  • Explore Feed:            ${url}/explore.html
  • Account Settings:        ${url}/settings.html
  • System Health Status:    ${url}/api/health

  Highlight Features to Try:
  -------------------------------------------------------------
  • Keyboard Navigation:     Press 'G' then 'H', 'L', 'E', 'A', 'C'
  • Accessibility:           Full WCAG 2.1 AA keyboard support + focus trap
  • Light & Dark Themes:     Toggle in navigation bar or Settings
  • Album Collage View:      Automatic responsive masonry collage
  • Secret Share Links:      View and share private albums anonymously

========================================================================
  [ Ready for Demo & Evaluation | Press Ctrl+C to shut down cleanly ]
========================================================================
`;
  console.log(banner);
}

function setupShutdownHooks() {
  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n\nShutting down Keepsake Demo cleanly...');

    if (server) {
      server.close();
      console.log('HTTP server stopped.');
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Mongoose connection disconnected.');
    }

    if (mongod) {
      await mongod.stop();
      console.log('In-memory MongoDB instance terminated.');
    }

    console.log('Keepsake shutdown complete. Goodbye!\n');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

if (require.main === module) {
  startDemo().catch((err) => {
    console.error('Fatal error starting demo:', err);
    process.exit(1);
  });
}

module.exports = { startDemo };

