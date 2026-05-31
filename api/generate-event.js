/**
 * Vercel serverless function — AI date-event generator.
 *
 * Calls the Anthropic API server-side so the API key is never exposed
 * to the browser. Returns structured JSON with scheduling suggestions.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { idea, preferredDate, preferredTime } = req.body ?? {};
  if (!idea) {
    res.status(400).json({ error: 'idea is required' });
    return;
  }

  const systemPrompt = `You are a thoughtful date-planning assistant. Given a date idea, return a JSON object with scheduling suggestions. Be romantic and practical. Return ONLY valid JSON with these exact fields:
{
  "suggestedTime": "HH:MM",
  "suggestedDuration": <minutes as integer>,
  "location": "<specific location suggestion or empty string>",
  "description": "<warm, personal description for the calendar event, 1-3 sentences>",
  "vibes": ["tag1", "tag2", "tag3"]
}
Vibe tags should be short, evocative words like: romantic, cozy, outdoor, adventurous, creative, foodie, sunset, spontaneous, peaceful, exciting.`;

  const userPrompt = `Date idea: "${idea}"
${preferredDate ? `Preferred date: ${preferredDate}` : ''}
${preferredTime ? `Preferred time: ${preferredTime}` : ''}

Suggest a time, duration, specific location, a short warm description, and 2-4 vibe tags.`;

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const raw  = message.content[0].text.trim();
    // Strip markdown code fences if present
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const data = JSON.parse(json);

    res.status(200).json(data);
  } catch (err) {
    console.error('AI generation error:', err);
    res.status(500).json({ error: err.message ?? 'AI generation failed' });
  }
}
