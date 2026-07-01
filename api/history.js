const supabaseAdmin = require('../lib/supabaseServer');
const { getUserFromRequest } = require('../lib/serverAuth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  const { data, error } = await supabaseAdmin
    .from('generations')
    .select('id, product_name, tone, language, seo_score, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: 'Database error' });

  return res.json(
    (data || []).map(g => ({
      id: g.id,
      productName: g.product_name,
      tone: g.tone,
      language: g.language,
      seoScore: g.seo_score,
      createdAt: g.created_at
    }))
  );
};
