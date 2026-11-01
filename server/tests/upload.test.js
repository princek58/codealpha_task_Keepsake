const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload');
const errorHandler = require('../middleware/errorHandler');

const createUploadTestApp = () => {
  const app = express();
  app.post('/test-upload', upload.single('file'), (req, res) => {
    res.status(200).json({
      message: 'Upload successful',
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  });
  app.use(errorHandler);
  return app;
};

describe('Upload Middleware', () => {
  const testApp = createUploadTestApp();
  const uploadedFiles = [];

  afterAll(() => {
    uploadedFiles.forEach((file) => {
      const filePath = path.join(__dirname, '../uploads', file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  test('Accepts valid image file (png) and assigns safe random filename', async () => {
    const fakeImageBuffer = Buffer.from('fake-png-content');

    const res = await request(testApp)
      .post('/test-upload')
      .attach('file', fakeImageBuffer, {
        filename: 'flower_photo.png',
        contentType: 'image/png'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Upload successful');
    expect(res.body.filename).toMatch(/^[a-f0-9]{32}\.png$/);
    uploadedFiles.push(res.body.filename);
  });

  test('Rejects non-image files with clear error', async () => {
    const textBuffer = Buffer.from('console.log("hello");');

    const res = await request(testApp)
      .post('/test-upload')
      .attach('file', textBuffer, {
        filename: 'malicious.js',
        contentType: 'application/javascript'
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Only image files/i);
  });

  test('Rejects image files larger than 2MB', async () => {
    const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0);

    const res = await request(testApp)
      .post('/test-upload')
      .attach('file', largeBuffer, {
        filename: 'huge_bloom.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/File too large/i);
  });
});

