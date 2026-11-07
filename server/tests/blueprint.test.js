// Keepsake Render Blueprint Validation Test Suite
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv2020 = require('ajv/dist/2020');

describe('Render Blueprint Specification & Security Audit', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const freeBlueprintPath = path.join(rootDir, 'render.yaml');
  const persistentBlueprintPath = path.join(rootDir, 'render.persistent.yaml');

  test('Both render.yaml and render.persistent.yaml exist and parse cleanly as YAML', () => {
    expect(fs.existsSync(freeBlueprintPath)).toBe(true);
    expect(fs.existsSync(persistentBlueprintPath)).toBe(true);

    const freeContent = fs.readFileSync(freeBlueprintPath, 'utf8');
    const persistentContent = fs.readFileSync(persistentBlueprintPath, 'utf8');

    const freeDoc = yaml.load(freeContent);
    const persistentDoc = yaml.load(persistentContent);

    expect(freeDoc).toBeDefined();
    expect(persistentDoc).toBeDefined();
    expect(Array.isArray(freeDoc.services)).toBe(true);
    expect(Array.isArray(persistentDoc.services)).toBe(true);
  });

  test('Free blueprint (render.yaml) has required service settings and zero secret values', () => {
    const doc = yaml.load(fs.readFileSync(freeBlueprintPath, 'utf8'));
    const service = doc.services[0];

    expect(service.type).toBe('web');
    expect(service.name).toBe('keepsake');
    expect(service.runtime).toBe('node');
    expect(service.plan).toBe('free');
    expect(service.region).toBe('singapore');
    expect(service.buildCommand).toBe('npm ci --omit=dev');
    expect(service.startCommand).toBe('npm start');
    expect(service.healthCheckPath).toBe('/api/health');

    const envMap = new Map();
    service.envVars.forEach((ev) => envMap.set(ev.key, ev));

    // Secret safety checks
    const mongoVar = envMap.get('MONGODB_URI');
    expect(mongoVar).toBeDefined();
    expect(mongoVar.sync).toBe(false);
    expect(mongoVar.value).toBeUndefined();

    const jwtVar = envMap.get('JWT_SECRET');
    expect(jwtVar).toBeDefined();
    expect(jwtVar.generateValue).toBe(true);
    expect(jwtVar.value).toBeUndefined();

    // Required environment values
    expect(envMap.get('NODE_VERSION').value).toBe('20');
    expect(envMap.get('NODE_ENV').value).toBe('production');
    expect(envMap.get('DEMO_MODE').value).toBe('true');
    expect(envMap.get('SEED_DEMO_ON_BOOT').value).toBe('true');
    expect(envMap.get('RECONCILE_STORAGE_ON_BOOT').value).toBe('true');
    expect(envMap.get('STORAGE_DIR').value).toBe('/tmp/keepsake-storage');
  });

  test('Persistent blueprint (render.persistent.yaml) configures Starter plan, SSD disk, and safety settings', () => {
    const doc = yaml.load(fs.readFileSync(persistentBlueprintPath, 'utf8'));
    const service = doc.services[0];

    expect(service.type).toBe('web');
    expect(service.name).toBe('keepsake');
    expect(service.runtime).toBe('node');
    expect(service.plan).toBe('starter');
    expect(service.disk).toEqual({
      name: 'keepsake-data',
      mountPath: '/var/data',
      sizeGB: 1
    });

    const envMap = new Map();
    service.envVars.forEach((ev) => envMap.set(ev.key, ev));

    expect(envMap.get('STORAGE_DIR').value).toBe('/var/data/storage');
    expect(envMap.get('DEMO_MODE').value).toBe('false');
    expect(envMap.get('SEED_DEMO_ON_BOOT').value).toBe('false');
    expect(envMap.get('RECONCILE_STORAGE_ON_BOOT').value).toBe('false');
    expect(envMap.get('MONGODB_URI').sync).toBe(false);
    expect(envMap.get('JWT_SECRET').generateValue).toBe(true);
  });

  test('Validates both blueprint documents against local schema structure', () => {
    const ajv = new Ajv2020({ strict: false });

    // Minimal structural schema verifying Render Blueprint contracts
    const blueprintSchema = {
      type: 'object',
      required: ['services'],
      properties: {
        services: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'name', 'runtime', 'plan', 'buildCommand', 'startCommand', 'healthCheckPath', 'envVars'],
            properties: {
              type: { type: 'string', enum: ['web', 'worker', 'cron'] },
              name: { type: 'string' },
              runtime: { type: 'string', enum: ['node', 'docker', 'python', 'ruby', 'go', 'rust'] },
              plan: { type: 'string' },
              buildCommand: { type: 'string' },
              startCommand: { type: 'string' },
              healthCheckPath: { type: 'string' },
              envVars: { type: 'array' }
            }
          }
        }
      }
    };

    const validate = ajv.compile(blueprintSchema);
    const freeDoc = yaml.load(fs.readFileSync(freeBlueprintPath, 'utf8'));
    const persistentDoc = yaml.load(fs.readFileSync(persistentBlueprintPath, 'utf8'));

    expect(validate(freeDoc)).toBe(true);
    expect(validate(persistentDoc)).toBe(true);
  });
});

