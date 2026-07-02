const supabaseAdmin = require('../lib/supabaseServer');
const { getUserFromRequest } = require('../lib/serverAuth');
const { getValidProfile } = require('../lib/planUtils');

function buildPrompt({ productName, category, features, targetAudience, tone, length, language }) {
  const toneMap = {
    casual: 'Santai, akrab, friendly seperti ngobrol dengan teman',
    formal: 'Formal, profesional, elegan',
    persuasive: 'Persuasif, menciptakan urgensi, mendorong pembelian'
  };
  const lengthMap = {
    short: 'sekitar 40–60 kata',
    standard: 'sekitar 80–120 kata',
    long: 'sekitar 150–200 kata'
  };
  const langMap = {
    id: 'Bahasa Indonesia',
    en: 'English',
    zh: 'Mandarin (Simplified Chinese)'
  };

  return `Kamu adalah copywriter e-commerce profesional untuk pasar Indonesia.
Tulis deskripsi produk yang menjual berdasarkan informasi dan foto (jika ada).

Aturan:
- Bahasa output: ${langMap[language] || 'Bahasa Indonesia'}
- Gaya/tone: ${toneMap[tone] || toneMap.casual}
- Panjang: ${lengthMap[length] || lengthMap.standard}
- Hanya gunakan klaim yang didukung informasi/foto. JANGAN mengarang fitur.
- Struktur: pembuka menarik, poin keunggulan, ajakan membeli (CTA).
- Jika ada foto, manfaatkan detail visual (warna, bahan, bentuk).
- Keluarkan HANYA teks deskripsi final, tanpa kalimat pembuka seperti "Berikut deskripsinya".

Informasi produk:
- Nama: ${productName}
- Kategori: ${category || '-'}
- Keunggulan: ${features}
- Target pembeli: ${targetAudience || 'Umum'}`;
}

function calcSeoScore(text, productName, features) {
  let score = 0;
  const lower = text.toLowerCase();

  if (lower.includes(productName.toLowerCase())) score += 30;

  const words = text.trim().split(/\s+/);
  if (words.length >= 50) score += 25;

  const featureWords = features.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
  const matchCount = featureWords.filter(w => lower.includes(w)).length;
  if (matchCount >= 2) score += 20;

  const ctaWords = ['beli', 'pesan', 'dapatkan', 'order', 'buy', 'get', 'shop', 'checkout', 'hubungi', 'segera'];
  if (ctaWords.some(w => lower.includes(w))) score += 15;

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 3) score += 10;

  return Math.min(score, 100);
}

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const profile = await getValidProfile(user.id);
  if (!profile) return res.status(401).json({ error: 'Profile not found' });

  if (profile.quota_limit !== -1 && profile.quota_used >= profile.quota_limit) {
    return res.status(403).json({
      error: 'quota_exceeded',
      quotaUsed: profile.quota_used,
      quotaLimit: profile.quota_limit
    });
  }

  const { productName, category, features, targetAudience, tone, length, language, imageBase64 } = req.body || {};

  if (!productName || !features) {
    return res.status(400).json({ error: 'productName and features are required' });
  }

  const prompt = buildPrompt({
    productName,
    category: category || '',
    features,
    targetAudience: targetAudience || '',
    tone: tone || 'casual',
    length: length || 'standard',
    language: language || 'id'
  });

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
  }

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );
  } catch (e) {
    return res.status(500).json({ error: 'network_error', message: 'Gagal menghubungi AI.' });
  }

  if (!geminiRes.ok) {
    const errData = await geminiRes.json().catch(() => ({}));
    if (geminiRes.status === 429) {
      return res.status(429).json({ error: 'rate_limit', message: 'Terlalu banyak permintaan, coba lagi sebentar.' });
    }
    console.error('Gemini error:', JSON.stringify(errData));
    return res.status(500).json({ error: 'gemini_error', detail: errData });
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) {
    return res.status(500).json({ error: 'empty_response', message: 'AI tidak menghasilkan teks.' });
  }

  const wordCount = text.trim().split(/\s+/).length;
  const seoScore = calcSeoScore(text, productName, features);

  await supabaseAdmin.from('generations').insert({
    user_id: user.id,
    product_name: productName,
    category: category || null,
    tone: tone || 'casual',
    language: language || 'id',
    input_features: features,
    output_text: text,
    word_count: wordCount,
    seo_score: seoScore
  });

  await supabaseAdmin.from('profiles').update({
    quota_used: profile.quota_used + 1
  }).eq('id', user.id);

  return res.status(200).json({
    text,
    wordCount,
    seoScore,
    quotaUsed: profile.quota_used + 1,
    quotaLimit: profile.quota_limit
  });
};

handler.config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb'
    }
  }
};

module.exports = handler;
