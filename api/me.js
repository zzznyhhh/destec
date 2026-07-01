const supabaseAdmin = require('../lib/supabaseServer');
const { getUserFromRequest } = require('../lib/serverAuth');
const { getValidProfile } = require('../lib/planUtils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const profile = await getValidProfile(user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  // Count total generations
  const { count } = await supabaseAdmin
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return res.json({
    fullName: profile.full_name,
    plan: profile.plan,
    quotaUsed: profile.quota_used,
    quotaLimit: profile.quota_limit,
    quotaReset: profile.quota_reset,
    planExpiresAt: profile.plan_expires_at,
    totalGenerations: count || 0
  });
};
