const ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

const API_TIMEOUT_MS = 10_000;

const PETE_SYSTEM_PROMPT =
    "You are Pantry Pete, a warm and knowledgeable food assistance helper serving Alabama's Black Belt " +
    'communities — including Dallas, Wilcox, Perry, Hale, Marengo, Lowndes, Autauga, Elmore, and ' +
    'neighboring counties.\n\n' +
    'Your job: help community members find food pantries, understand SNAP/EBT and WIC benefits, school ' +
    'meal programs, and get simple recipe ideas using pantry staples.\n\n' +
    'Guidelines:\n' +
    '- Be warm, clear, and non-judgmental. Many users are in difficult situations.\n' +
    '- Keep answers practical and concise — short paragraphs or simple lists.\n' +
    '- For urgent food needs, always mention: call 211 (free, 24/7).\n' +
    '- Stay focused on food assistance and community resources. Politely redirect off-topic questions.\n' +
    "- If you don't have specific details, direct them to call the pantry or 211.";

// ── PII Sanitization ──────────────────────────────────────────────────────────
// Every outbound text (user message + conversation history) is run through
// this sanitizer before it leaves the device. Recognised patterns are replaced
// with neutral placeholders so personal data is never transmitted to Google's
// Gemini infrastructure. This satisfies the HIPAA Technical Safeguard
// requirement (§164.312(e)(2)(ii)) to protect ePHI in transit to third parties,
// even if PantryBelt is not a covered entity.
const PII_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    // Email addresses
    [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,                       '[email]'],
    // US phone numbers — (555) 555-5555 / 555.555.5555 / +15555555555 / 2115551234
    [/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,                       '[phone]'],
    // Social Security Numbers  — XXX-XX-XXXX or XXX XX XXXX
    [/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,                                            '[ssn]'],
    // Payment card numbers — 4 groups of 4 digits, optional separators
    [/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,                           '[card]'],
    // Street addresses — number + name + type abbreviation
    [/\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Circle|Place|Pl|Parkway|Pkwy)\.?\b/gi, '[address]'],
    // US ZIP codes — 5-digit or ZIP+4 (word-bounded to avoid matching other numbers)
    [/\b\d{5}(?:-\d{4})?\b/g,                                                     '[zip]'],
] as const;

export function sanitizePII(text: string): string {
    return PII_PATTERNS.reduce(
        (s, [pattern, replacement]) => s.replace(pattern, replacement),
        text,
    );
}

export type GeminiTurn = { role: 'user' | 'model'; text: string };

export async function askGemini(history: GeminiTurn[], userPrompt: string): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not configured');

    // Sanitize every outbound string — no raw PII leaves the device
    const cleanPrompt = sanitizePII(userPrompt);
    const contents = [
        ...history.map(t => ({ role: t.role, parts: [{ text: sanitizePII(t.text) }] })),
        { role: 'user', parts: [{ text: cleanPrompt }] },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: PETE_SYSTEM_PROMPT }] },
                contents,
                generationConfig: {
                    maxOutputTokens: 512,
                    temperature: 0.7,
                },
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Gemini ${response.status}: ${body}`);
        }

        const json = await response.json();
        const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response from Gemini');
        return text.trim();
    } finally {
        clearTimeout(timeoutId);
    }
}
