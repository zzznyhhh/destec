const supabaseAdmin = require('../lib/supabaseServer');
const { getUserFromRequest } = require('../lib/serverAuth');

const PRICES = {
  basic: { monthly: 15000, yearly: 144000 },
  pro: { monthly: 49000, yearly: 470000 }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { plan, period } = req.body || {};

  if (!['basic', 'pro'].includes(plan) || !['monthly', 'yearly'].includes(period)) {
    return res.status(400).json({ error: 'Invalid plan or period' });
  }

  const amount = PRICES[plan][period];
  const orderId = `DESTEC-${user.id.slice(0, 8)}-${Date.now()}`;

  // Get user email
  let email = 'user@destec.id';
  try {
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(user.id);
    email = authUser?.email || email;
  } catch (e) {
    console.error('Failed to get user email:', e);
  }

  // Insert pending payment record
  const { error: insertErr } = await supabaseAdmin.from('payments').insert({
    user_id: user.id,
    order_id: orderId,
    plan,
    period,
    amount,
    status: 'pending'
  });

  if (insertErr) {
    console.error('Payment insert error:', insertErr);
    return res.status(500).json({ error: 'Failed to create payment record' });
  }

  // Call Midtrans Snap API
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const snapUrl = isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  const auth64 = Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64');
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const periodLabel = period === 'monthly' ? '1 bulan' : '1 tahun';
  const itemName = `Destec ${planLabel} (${periodLabel})`;

  let snapRes;
  try {
    snapRes = await fetch(snapUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth64}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: plan, price: amount, quantity: 1, name: itemName }],
        customer_details: { email }
      })
    });
  } catch (e) {
    return res.status(500).json({ error: 'network_error', message: 'Gagal menghubungi payment gateway.' });
  }

  if (!snapRes.ok) {
    const err = await snapRes.json().catch(() => ({}));
    console.error('Midtrans error:', err);
    return res.status(500).json({ error: 'payment_error', detail: err });
  }

  const snapData = await snapRes.json();
  return res.json({ token: snapData.token, orderId });
};
