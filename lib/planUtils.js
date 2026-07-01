const supabaseAdmin = require('./supabaseServer');

async function getValidProfile(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) return null;

  const updates = {};

  // Downgrade if plan expired
  if (profile.plan !== 'free' && profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
    updates.plan = 'free';
    updates.quota_limit = 5;
    updates.plan_expires_at = null;
    profile.plan = 'free';
    profile.quota_limit = 5;
    profile.plan_expires_at = null;
  }

  // Reset quota if past reset date
  if (profile.quota_reset && profile.quota_reset <= today) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    updates.quota_used = 0;
    updates.quota_reset = nextReset.toISOString().split('T')[0];
    profile.quota_used = 0;
    profile.quota_reset = updates.quota_reset;
  }

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
  }

  return profile;
}

module.exports = { getValidProfile };
