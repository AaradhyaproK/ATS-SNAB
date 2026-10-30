import crypto from 'crypto';

/**
 * Vercel Serverless Function: GitHub Marketplace Webhook Handler
 * Endpoint: /api/marketplace-webhook
 * Handles incoming GitHub Marketplace events (marketplace_purchase, ping, etc.)
 */
export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-Event, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check / verification
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'active', service: 'InterviewXpert GitHub Marketplace Webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const event = req.headers['x-github-event'] || 'unknown';
    const signature = req.headers['x-hub-signature-256'] || '';
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // Optional HMAC signature verification if secret is configured
    if (secret && signature) {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
      if (signature !== digest) {
        console.warn('[GitHub Webhook] Invalid signature received');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Ping event verification from GitHub
    if (event === 'ping') {
      console.log('[GitHub Webhook] Received ping from GitHub Marketplace. Hook verified!');
      return res.status(200).json({ status: 'ok', message: 'Pong! Webhook verified successfully.' });
    }

    // Marketplace purchase events (purchased, cancelled, changed, pending_change)
    if (event === 'marketplace_purchase') {
      const { action, effective_date, sender, marketplace_purchase } = req.body || {};
      const account = marketplace_purchase?.account;
      const plan = marketplace_purchase?.plan;

      console.log(`[GitHub Marketplace] Action: ${action} | Account: ${account?.login} | Plan: ${plan?.name}`);

      // Handle marketplace actions here if needed
      switch (action) {
        case 'purchased':
          console.log(`[GitHub Marketplace] New subscriber: ${account?.login} on plan ${plan?.name}`);
          break;
        case 'cancelled':
          console.log(`[GitHub Marketplace] Subscription cancelled for: ${account?.login}`);
          break;
        case 'changed':
          console.log(`[GitHub Marketplace] Plan changed for: ${account?.login} to ${plan?.name}`);
          break;
        default:
          break;
      }
    }

    return res.status(200).json({ received: true, event });
  } catch (error) {
    console.error('[GitHub Webhook Error]:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

