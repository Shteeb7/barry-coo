const { supabase } = require('../services/supabase');

// Parse allowed emails from environment variable
const allowedEmails = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(email => email.trim())
  .filter(email => email.length > 0);

/**
 * Middleware to validate JWT and check email allowlist
 */
async function validateAuth(req, res, next) {
  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user's email is in the allowlist
    if (allowedEmails.length > 0 && !allowedEmails.includes(user.email)) {
      console.warn(`🎩 [Auth] Unauthorized access attempt from: ${user.email}`);
      return res.status(403).json({ error: 'Access denied. You are not authorized to access Barry.' });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (err) {
    console.error('🎩 [Auth] Authentication error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = { validateAuth };
