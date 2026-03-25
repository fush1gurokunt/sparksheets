// ── IP-based usage tracking ────────────────────────────────────
// Simple in-memory store: Map<ip, { count, firstSeen }>
// Resets per-IP after 30 days. Pro users bypass via isPro flag.
const FREE_LIMIT   = 5;
const RESET_MS     = 30 * 24 * 60 * 60 * 1000; // 30 days
const usageStore   = new Map();

function getIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkAndIncrement(ip) {
  const now  = Date.now();
  const entry = usageStore.get(ip);

  if (!entry || now - entry.firstSeen > RESET_MS) {
    usageStore.set(ip, { count: 1, firstSeen: now });
    return { allowed: true, count: 1 };
  }

  if (entry.count >= FREE_LIMIT) {
    return { allowed: false, count: entry.count };
  }

  entry.count += 1;
  return { allowed: true, count: entry.count };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, userMessage, model, max_tokens, isPro } = req.body || {};

  if (!systemPrompt || !userMessage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Enforce IP-based free limit (Pro users bypass)
  if (!isPro) {
    const ip = getIP(req);
    const { allowed } = checkAndIncrement(ip);
    if (!allowed) {
      return res.status(429).json({ error: 'limit_reached' });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-opus-4-6',
        max_tokens: max_tokens || 8000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Anthropic API' });
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json({
      error: body?.error?.message || `Anthropic API error ${upstream.status}`,
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
};
