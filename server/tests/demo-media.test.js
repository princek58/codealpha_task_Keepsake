// Keepsake Demo Media Manifest & Integrity Test Suite
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEMO_MEDIA_DIR = path.resolve(__dirname, '../../demo-media');
const MANIFEST_PATH = path.join(DEMO_MEDIA_DIR, 'manifest.json');
const CREDITS_PATH = path.join(DEMO_MEDIA_DIR, 'CREDITS.md');

describe('Demo Media Dataset Integrity Audit', () => {
  let manifest;

  beforeAll(() => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    manifest = JSON.parse(content);
  });

  test('Manifest contains 76 curated media items (70 photos, 6 videos)', () => {
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBe(76);

    const photos = manifest.filter((m) => m.type === 'image');
    const videos = manifest.filter((m) => m.type === 'video');

    expect(photos.length).toBe(70);
    expect(videos.length).toBe(6);
  });

  test('All 7 themes are represented evenly across photos', () => {
    const requiredThemes = ['travel', 'home', 'friends', 'pets', 'food', 'nature', 'hobbies'];
    const photos = manifest.filter((m) => m.type === 'image');

    requiredThemes.forEach((theme) => {
      const count = photos.filter((p) => p.theme === theme).length;
      expect(count).toBe(10);
    });
  });

  test('Every manifest entry has all required schema fields and valid licensing', () => {
    manifest.forEach((item) => {
      expect(item.id).toBeDefined();
      expect(['image', 'video']).toContain(item.type);
      expect(item.filename).toBeDefined();
      expect(item.sourceSite).toBe('Pexels');
      expect(item.sourcePageUrl).toMatch(/^https:\/\/www\.pexels\.com\//);
      expect(item.creatorName).toBeDefined();
      expect(item.creatorName.trim().length).toBeGreaterThan(0);
      expect(item.license).toBe('Pexels License');
      expect(typeof item.width).toBe('number');
      expect(typeof item.height).toBe('number');
      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(0);
      expect(item.theme).toBeDefined();
      expect(item.albumGroup).toBeDefined();
      expect(item.caption).toBeDefined();
      expect(item.caption.length).toBeGreaterThan(5);
      expect(typeof item.sizeBytes).toBe('number');
    });
  });

  test('Every media file exists on disk and images match recorded dimensions', async () => {
    for (const item of manifest) {
      const subDir = item.type === 'image' ? 'photos' : 'videos';
      const filePath = path.join(DEMO_MEDIA_DIR, subDir, item.filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const stat = fs.statSync(filePath);
      expect(stat.size).toBe(item.sizeBytes);

      if (item.type === 'image') {
        const meta = await sharp(filePath).metadata();
        expect(meta.width).toBe(item.width);
        expect(meta.height).toBe(item.height);
        // Normalized: long edge must not exceed 1600px
        expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1600);
      } else {
        // Video under 6 MB
        expect(stat.size).toBeLessThan(6 * 1024 * 1024);
      }
    }
  });

  test('Total demo-media footprint is under the 45 MB threshold', () => {
    const totalBytes = manifest.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    const maxBytes = 45 * 1024 * 1024;
    expect(totalBytes).toBeLessThan(maxBytes);
  });

  test('CREDITS.md exists and credits all creators with source links', () => {
    expect(fs.existsSync(CREDITS_PATH)).toBe(true);
    const credits = fs.readFileSync(CREDITS_PATH, 'utf8');
    expect(credits).toContain('Pexels License');
    expect(credits).toContain('https://www.pexels.com/');

    // Check a sample of creators
    manifest.slice(0, 10).forEach((item) => {
      expect(credits).toContain(item.creatorName);
      expect(credits).toContain(item.filename);
    });
  });
});

