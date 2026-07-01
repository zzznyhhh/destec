const crypto = require('crypto');
const supabaseAdmin = require('../lib/supabaseServer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status
  } = req.body || {};

  // Verify Midtrans signature
  const expectedSig = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');

  if (signature_key !== expectedSig) {
    console.error('Invalid webhook signature for order:', order_id);
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Find payment record
  const { data: payment, error: payErr } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('order_id', order_id)
    .single();

  if (payErr || !payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // settlement covers bank transfer; capture + accept covers card/e-wallet
  const isSuccess =
    transaction_status === 'settlement' ||
    (transaction_status === 'capture' && fraud_status === 'accept');

  const isFailed = ['expire', 'cancel', 'deny'].includes(transaction_status);

  if (isSuccess) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'paid' })
      .eq('order_id', order_id);

    const quotaLimitMap = { basic: 40, pro: 400 };

    const expiresAt = new Date();
    if (payment.period === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const quotaReset = new Date();
    quotaReset.setMonth(quotaReset.getMonth() + 1);

    await supabaseAdmin
      .from('profiles')
      .update({
        plan: payment.plan,
        quota_limit: quotaLimitMap[payment.plan],
        quota_used: 0,
        plan_expires_at: expiresAt.toISOString(),
        quota_reset: quotaReset.toISOString().split('T')[0]
      })
      .eq('id', payment.user_id);

  } else if (isFailed) {
    const newStatus = transaction_status === 'expire' ? 'expired' : 'failed';
    await supabaseAdmin
      .from('payments')
      .update({ status: newStatus })
      .eq('order_id', order_id);
  }

  // Always respond 200 so Midtrans stops retrying
  return res.status(200).json({ ok: true });
};
