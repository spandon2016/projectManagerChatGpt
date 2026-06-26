import { afterAll, beforeAll, expect, test } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { usersAPI } from '../../services/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '../../../backend');
const backendUrl = 'http://127.0.0.1:5000';
const adminEmail = 'stan@example.com';
const testUser = {
  email: 'testuser@user.com',
  password: 'Password123!',
  name: 'Test User'
};

let backendProcess;
let adminUserId;

beforeAll(async () => {
  await runSeedScript();

  backendProcess = spawn('node', ['server.js'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await waitForBackendReady();

  const adminUser = await usersAPI.getByEmail(adminEmail);
  if (!adminUser || !adminUser.id) {
    throw new Error(`Admin user not found after seeding: ${adminEmail}`);
  }

  adminUserId = adminUser.id;
}, 30000);

afterAll(() => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

async function runSeedScript() {
  return new Promise((resolve, reject) => {
    const seedProcess = spawn('node', ['seed-admin.js'], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    seedProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    seedProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Seed script exited with code ${code}: ${stderr}`));
      }
    });
  });
}

async function waitForBackendReady(timeoutMs = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (backendProcess.exitCode !== null) {
      throw new Error(`Backend process exited prematurely with code ${backendProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${backendUrl}/api/users`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until ready
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Backend did not start within 15 seconds');
}

test('creates and deletes a user named testuser@user.com', async () => {
  const existingUser = await usersAPI.getByEmail(testUser.email);
  if (existingUser?.id) {
    await usersAPI.deleteAdmin(existingUser.id, adminUserId);
  }

  const testUserWithId = {
    id: `testuser-${Date.now()}`,
    ...testUser
  };

  const createdUser = await usersAPI.createAdmin(testUserWithId, adminUserId);

  expect(createdUser).toBeTruthy();
  expect(createdUser.email).toBe(testUser.email);
  expect(createdUser.id).toBeDefined();

  const deleteResult = await usersAPI.deleteAdmin(createdUser.id, adminUserId);

  expect(deleteResult).toBeTruthy();
  expect(deleteResult.success).toBe(true);
});
