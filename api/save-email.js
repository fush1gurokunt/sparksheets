module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Log for now — connect to mailing service later
  console.log('[save-email]', new Date().toISOString(), email);

  return res.status(200).json({ ok: true });
};
