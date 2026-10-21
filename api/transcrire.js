const FENETRE_MS = 10 * 60 * 1000;
const MAX_APPELS = 20;
const compteurs = new Map();

function limite(ip) {
  const now = Date.now();
  const liste = (compteurs.get(ip) || []).filter(t => now - t < FENETRE_MS);
  if (liste.length >= MAX_APPELS) { compteurs.set(ip, liste); return true; }
  liste.push(now);
  compteurs.set(ip, liste);
  if (compteurs.size > 5000) compteurs.clear();
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ erreur: "GROQ_API_KEY manquante sur Vercel" });

  const ip = String(req.headers["x-forwarded-for"] || "inconnue").split(",")[0].trim();
  if (limite(ip)) return res.status(429).json({ erreur: "Trop de demandes. Réessaie dans quelques minutes." });

  const audio = req.body && req.body.audio;
  const type = String((req.body && req.body.type) || "audio/webm").split(";")[0];

  if (typeof audio !== "string" || !audio || audio.length > 3000000) {
    return res.status(400).json({ erreur: "Audio invalide ou trop long" });
  }
  if (!/^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|m4a)$/.test(type)) {
    return res.status(400).json({ erreur: "Format audio non pris en charge" });
  }

  const ext = type.includes("ogg") ? "ogg"
    : (type.includes("mp4") || type.includes("m4a")) ? "m4a"
    : type.includes("mpeg") ? "mp3"
    : type.includes("wav") ? "wav" : "webm";

  try {
    const buf = Buffer.from(audio, "base64");
    const form = new FormData();
    form.append("file", new Blob([buf], { type }), "signalement." + ext);
    form.append("model", process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo");
    form.append("language", "fr");
    form.append("temperature", "0");
    form.append("response_format", "json");
    form.append("prompt", "Signalement d'une panne d'eau : forage, pompe, borne-fontaine, puits, Abomey-Calavi, Godomey, Tanpkè, Zogbadjè, Cotonou.");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: form,
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return res.status(502).json({ erreur: "Transcription refusée (code " + r.status + ")" });

    const d = await r.json();
    return res.status(200).json({ texte: String(d.text || "").trim().slice(0, 1000) });
  } catch (e) {
    return res.status(500).json({ erreur: "Transcription impossible" });
  }
};
