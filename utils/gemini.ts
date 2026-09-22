import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export type GeminiTurn = { role: 'user' | 'model'; text: string };

// ── PII Sanitization ──────────────────────────────────────────────────────────
// Outbound text is sanitized before leaving the device so sensitive personal data
// is replaced with neutral placeholders prior to transmission.
const PII_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    // Email addresses
    [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,                       '[email]'],
    // US phone numbers
    [/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,                       '[phone]'],
    // Social Security Numbers
    [/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,                                            '[ssn]'],
    // Payment card numbers
    [/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,                           '[card]'],
    // Street addresses
    [/\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Circle|Place|Pl|Parkway|Pkwy)\.?\b/gi, '[address]'],
    // US ZIP codes
    [/\b\d{5}(?:-\d{4})?\b/g,                                                     '[zip]'],
] as const;

export function sanitizePII(text: string): string {
    return PII_PATTERNS.reduce(
        (s, [pattern, replacement]) => s.replace(pattern, replacement),
        text,
    );
}

/**
 * askGemini()
 * Calls the secure serverless Cloud Function `askPete`.
 * The Gemini API key is stored server-side in Google Secret Manager and is NEVER
 * included in the mobile client application bundle.
 */
export async function askGemini(history: GeminiTurn[], userPrompt: string): Promise<string> {
    const cleanPrompt = sanitizePII(userPrompt);
    const cleanHistory = history.map(t => ({
        role: t.role,
        text: sanitizePII(t.text),
    }));

    try {
        const askPeteCallable = httpsCallable<{ history: GeminiTurn[]; userPrompt: string }, { text: string }>(
            functions,
            'askPete'
        );

        const result = await askPeteCallable({
            history: cleanHistory,
            userPrompt: cleanPrompt,
        });

        const replyText = result.data?.text;
        if (!replyText) {
            throw new Error('Empty response from Pete.');
        }

        return replyText.trim();
    } catch (err: any) {
        const code = err?.code || '';
        const message = err?.message || '';

        if (code === 'functions/resource-exhausted' || code === 'resource-exhausted' || message.includes('30 messages') || message.includes('limit')) {
            const friendlyRateLimit = "You've reached your limit of 30 messages with Pete today. Pete will be ready to help again tomorrow!";
            const error = new Error(friendlyRateLimit);
            (error as any).code = 'resource-exhausted';
            throw error;
        }

        if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
            const error = new Error("Please wait a moment while your secure session connects, then try again.");
            (error as any).code = 'unauthenticated';
            throw error;
        }

        throw err;
    }
}
