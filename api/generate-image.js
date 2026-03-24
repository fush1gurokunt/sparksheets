module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Missing required field: prompt' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach OpenAI API' });
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    return res.status(upstream.status).json({
      error: `DALL-E error ${upstream.status}: ${errText.slice(0, 200)}`,
    });
  }

  const data = await upstream.json();
  res.json(data);
};
