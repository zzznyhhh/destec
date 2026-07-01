module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=3600');
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    midtransClientKey: process.env.MIDTRANS_CLIENT_KEY,
    midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true'
  });
};
