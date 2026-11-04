const fs = require('fs');
const path = require('path');
const config = require('../../config');

class LocalStorageDriver {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir || config.storageDir);
    this.tmpDir = path.join(this.baseDir, 'tmp');
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  resolveSafePath(relPath) {
    if (!relPath || typeof relPath !== 'string') {
      throw new Error('Invalid path argument');
    }
    const baseDir = path.resolve(this.baseDir);
    const absoluteTarget = path.resolve(baseDir, relPath);
    const relative = path.relative(baseDir, absoluteTarget);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path traversal detected: "${relPath}"`);
    }

    return absoluteTarget;
  }

  async exists(relPath) {
    try {
      const target = this.resolveSafePath(relPath);
      await fs.promises.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async stat(relPath) {
    const target = this.resolveSafePath(relPath);
    return fs.promises.stat(target);
  }

  createReadStream(relPath, options) {
    const target = this.resolveSafePath(relPath);
    return fs.createReadStream(target, options);
  }

  async save(sourcePath, destRelPath) {
    const destPath = this.resolveSafePath(destRelPath);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    try {
      await fs.promises.rename(sourcePath, destPath);
    } catch (err) {
      if (err.code === 'EXDEV' || err.code === 'EBUSY' || err.code === 'EPERM') {
        await fs.promises.copyFile(sourcePath, destPath);
        try {
          await fs.promises.unlink(sourcePath);
        } catch {
          // If Windows still locks sourcePath briefly, it will be cleaned by cleanTmp
        }
      } else {
        throw err;
      }
    }
    return destPath;
  }

  async move(sourcePath, destRelPath) {
    return this.save(sourcePath, destRelPath);
  }

  async writeBuffer(destRelPath, buffer) {
    const destPath = this.resolveSafePath(destRelPath);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.writeFile(destPath, buffer);
    return destPath;
  }

  async remove(relPath) {
    try {
      const target = this.resolveSafePath(relPath);
      await fs.promises.rm(target, { recursive: true, force: true });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async cleanTmp() {
    this.ensureDirs();
    try {
      const entries = await fs.promises.readdir(this.tmpDir);
      for (const entry of entries) {
        if (entry === '.gitkeep') continue;
        const entryPath = path.join(this.tmpDir, entry);
        await fs.promises.rm(entryPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore errors if directory is already empty or being recreated
    }
  }

  getTmpDir() {
    this.ensureDirs();
    return this.tmpDir;
  }

  getAbsolutePath(relPath) {
    return this.resolveSafePath(relPath);
  }
}

module.exports = LocalStorageDriver;
