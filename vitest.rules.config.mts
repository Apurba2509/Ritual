import { defineConfig } from 'vitest/config';

// Security-rules tests need the Firestore emulator (npm run emulators).
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
