import { createClient } from '@supabase/supabase-js';

const allowedOrigins = new Set(['https://localhost', 'http://localhost:3000', 'https://dojo-omega-two.vercel.app']);

export default async function handler(req: any, res: any) {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  const isAllowedOrigin = allowedOrigins.has(origin) || /^https:\/\/dojo-omega-two(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin);
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (origin && !isAllowedOrigin) return res.status(403).json({ error: 'This app origin is not allowed.' });

  const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publicKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!projectUrl || !publicKey || !serviceKey) {
    return res.status(503).json({ error: 'Account deletion is not configured on the server.' });
  }

  const header = req.headers?.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length > 8192) return res.status(401).json({ error: 'Sign in again before deleting your account.' });

  try {
    const userClient = createClient(projectUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Your session expired. Sign in again, then retry.' });

    const adminClient = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('Account deletion failed:', deleteError.message);
      return res.status(500).json({ error: 'We could not delete the account right now. Please try again.' });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Account deletion endpoint failed:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: 'We could not delete the account right now. Please try again.' });
  }
}
