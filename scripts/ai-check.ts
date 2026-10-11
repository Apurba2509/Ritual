/// <reference types="node" />
/**
 * Checks that Firebase AI Logic (Gemini) is reachable with the config in .env.
 *   npm run ai:check                        # default fast model
 *   npm run ai:check -- gemini-3.5-flash LOW
 */
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel } from 'firebase/ai';
const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
});
const model = process.argv[2] ?? 'gemini-3.5-flash-lite';
const level = process.argv[3] ?? 'LOW';
(async () => {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const m = getGenerativeModel(ai, {
    model,
    generationConfig: {
      ...(level ? { thinkingConfig: { thinkingLevel: (ThinkingLevel as Record<string, string>)[level] } } : {}),
      responseMimeType: 'application/json',
      responseSchema: Schema.object({ properties: { habits: Schema.array({ items: Schema.string() }) } }),
    },
  });
  const t = Date.now();
  const r = await m.generateContent('List the habits in: "ran 5k, read 20 pages and meditated 15 minutes"');
  console.log(model, level ?? 'default', 'OK in', Date.now() - t, 'ms →', r.response.text());
})().catch((e) => {
  console.log(model, 'FAILED →', String(e?.message ?? e).slice(0, 400));
  process.exit(1);
});
