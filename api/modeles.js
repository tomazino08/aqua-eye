module.exports = async function handler(req, res) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ erreur: "GROQ_API_KEY manquante" });
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return res.status(502).json({ erreur: "Groq : code " + r.status });
    const d = await r.json();
    return res.status(200).json((d.data || []).map(m => m.id));
  } catch (e) {
    return res.status(500).json({ erreur: "Liste indisponible" });
  }
};
