module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Missing required field: prompt' });
  }

  const apiKey = process.env.GEMINI_API;
  console.log('GEMINI_API_KEY present:', !!apiKey, 'length:', apiKey ? apiKey.length : 0);
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const model = 'gemini-3.1-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Gemini API' });
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    return res.status(upstream.status).json({
      error: `Gemini error ${upstream.status}: ${errText.slice(0, 200)}`,
    });
  }

  const data = await upstream.json();

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data);

  if (!imagePart) {
    return res.status(502).json({ error: 'Gemini response had no image data' });
  }

  res.json({ data: [{ b64_json: imagePart.inlineData.data }] });
};
