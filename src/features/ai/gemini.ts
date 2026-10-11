import { getAI, getGenerativeModel, GoogleAIBackend, ObjectSchema, ThinkingLevel } from 'firebase/ai';
import { firebase, isFirebaseConfigured, usingEmulators } from '@/lib/firebase';

/**
 * Gemini via Firebase AI Logic: the API key never ships in the app — requests are proxied
 * by Firebase, and responses are constrained to a JSON schema so they parse reliably.
 *
 * Two tiers, both stable models with long support windows:
 *  - fast  → quick logging, where the user is waiting with the keyboard open (~1.5 s)
 *  - smart → coach plans and weekly reviews, where quality matters more (~3 s)
 * Thinking is kept LOW: these are structured extraction tasks, and default thinking
 * made responses 30–60× slower in testing.
 */

const MODELS = {
  fast: process.env.EXPO_PUBLIC_GEMINI_MODEL_FAST || 'gemini-3.5-flash-lite',
  smart: process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.5-flash',
} as const;

export type AITier = keyof typeof MODELS;

// AI Logic isn't part of the local emulator suite.
export const aiConfigured = isFirebaseConfigured && !usingEmulators && process.env.EXPO_PUBLIC_AI_DISABLED !== 'true';

export class AIUnavailableError extends Error {}

/** Models that rejected a thinking config once — don't send it to them again. */
const noThinking = new Set<string>();

export async function generateJSON<T>(params: {
  system: string;
  prompt: string;
  schema: ObjectSchema;
  tier?: AITier;
  temperature?: number;
  timeoutMs?: number;
}): Promise<T> {
  const fb = firebase();
  if (!fb || !aiConfigured) throw new AIUnavailableError('AI is not configured.');
  const ai = getAI(fb.app, { backend: new GoogleAIBackend() });
  const modelName = MODELS[params.tier ?? 'fast'];

  const run = async (withThinking: boolean) => {
    const model = getGenerativeModel(ai, {
      model: modelName,
      systemInstruction: params.system,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: params.schema,
        temperature: params.temperature ?? 0.4,
        ...(withThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('The AI took too long to respond.')), params.timeoutMs ?? 20_000),
    );
    return Promise.race([model.generateContent(params.prompt), timeout]);
  };

  let result;
  try {
    result = await run(!noThinking.has(modelName));
  } catch (e) {
    // Some models don't accept a thinking level — remember that and retry without it.
    if (/thinking/i.test(String((e as Error)?.message)) && !noThinking.has(modelName)) {
      noThinking.add(modelName);
      result = await run(false);
    } else {
      throw e;
    }
  }

  const text = result.response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The AI returned something unexpected. Try rephrasing.');
  }
}

export function aiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/app.?check/i.test(msg))
    return 'AI is blocked by App Check. Set Firebase AI Logic to "Unenforced" in the console.';
  if (/api.*not.*enabled|AI Logic|PERMISSION_DENIED|403/i.test(msg))
    return 'Enable Firebase AI Logic (Gemini Developer API) in the Firebase console.';
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(msg)) return 'The AI is busy (free quota reached). Try again in a minute.';
  if (/too long/i.test(msg)) return 'The AI took too long — using on-device parsing instead.';
  if (/network|fetch|offline/i.test(msg)) return "You're offline — using on-device parsing instead.";
  return msg;
}
