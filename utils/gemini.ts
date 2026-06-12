const ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

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
    "- Stay focused on food assistance and community resources. Politely redirect off-topic questions.\n" +
    "- If you don't have specific details, direct them to call the pantry or 211.";

export type GeminiTurn = { role: 'user' | 'model'; text: string };

export async function askGemini(history: GeminiTurn[], userPrompt: string): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not configured');

    const contents = [
        ...history.map(t => ({ role: t.role, parts: [{ text: t.text }] })),
        { role: 'user', parts: [{ text: userPrompt }] },
    ];

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
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini ${response.status}: ${body}`);
    }

    const json = await response.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text.trim();
}
