const bcrypt = require('bcryptjs');
const { PASSWORD_REQUIREMENT, isUsablePasswordInput, isStrongPassword } = require('./passwordPolicy');

const validEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function mountAccount(app, pool, authenticate, rateLimit) {
  app.get('/api/account', authenticate, async (req, res) => {
    try {
      const result = await pool.query(`SELECT u.id,u.owner_name,u.phone,u.email,u.user_type,u.phone_verified,u.phone_verified_at,u.created_at,u.password_changed_at,
        (SELECT COUNT(*)::int FROM user_activities a WHERE a.user_id=u.id) AS activity_count,
        (SELECT COUNT(*)::int FROM user_activities a WHERE a.user_id=u.id AND a.action_type='review') AS review_count,
        (SELECT COUNT(*)::int FROM user_activities a WHERE a.user_id=u.id AND a.action_type IN ('call','whatsapp','directions')) AS contact_action_count,
        (SELECT COUNT(*)::int FROM referral_earnings e WHERE e.user_id=u.id) AS referred_shop_count,
        COALESCE((SELECT SUM(e.reward_paise)::bigint FROM referral_earnings e WHERE e.user_id=u.id AND e.status='available'),0)::bigint AS available_reward_paise
        FROM users u WHERE u.id=$1`, [req.user.userId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Account not found.' });
      return res.set('Cache-Control', 'no-store').json({ account: result.rows[0] });
    } catch (error) {
      console.error('Account overview failed:', error.message);
      return res.status(500).json({ error: 'Unable to load account.' });
    }
  });

  app.patch('/api/account/profile', authenticate, async (req, res) => {
    const ownerName = String(req.body?.owner_name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase() || null;
    if (ownerName.length < 2 || ownerName.length > 120) return res.status(400).json({ error: 'Name must contain 2 to 120 characters.' });
    if (!validEmail(email) || (email && email.length > 255)) return res.status(400).json({ error: 'Enter a valid email address.' });
    try {
      const duplicate = await pool.query('SELECT id FROM users WHERE email=$1 AND id<>$2', [email, req.user.userId]);
      if (email && duplicate.rows.length) return res.status(409).json({ error: 'This email is already registered.' });
      const result = await pool.query(`UPDATE users SET owner_name=$1,email=$2 WHERE id=$3
        RETURNING id,owner_name,phone,email,user_type,is_admin,phone_verified`, [ownerName, email, req.user.userId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Account not found.' });
      return res.json({ message: 'Profile updated.', user: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This email is already registered.' });
      console.error('Profile update failed:', error.message);
      return res.status(500).json({ error: 'Unable to update profile.' });
    }
  });

  app.post('/api/account/password', authenticate, rateLimit(5, 60 * 60 * 1000, 'account-password'), async (req, res) => {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: PASSWORD_REQUIREMENT });
    if (!isUsablePasswordInput(currentPassword)) return res.status(401).json({ error: 'Current password is incorrect.' });
    if (currentPassword === newPassword) return res.status(400).json({ error: 'Choose a different new password.' });
    try {
      const current = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.userId]);
      if (!current.rows.length || !(await bcrypt.compare(currentPassword, current.rows[0].password || ''))) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query(`UPDATE users SET password=$1,password_changed_at=CURRENT_TIMESTAMP,auth_version=auth_version+1 WHERE id=$2`, [hash, req.user.userId]);
      return res.json({ message: 'Password changed. All devices have been signed out.' });
    } catch (error) {
      console.error('Password update failed:', error.message);
      return res.status(500).json({ error: 'Unable to change password.' });
    }
  });

  app.post('/api/account/sign-out-all', authenticate, rateLimit(10, 60 * 60 * 1000, 'account-sign-out'), async (req, res) => {
    try {
      await pool.query('UPDATE users SET auth_version=auth_version+1 WHERE id=$1', [req.user.userId]);
      return res.json({ message: 'All devices have been signed out.' });
    } catch (error) {
      console.error('Sign out all failed:', error.message);
      return res.status(500).json({ error: 'Unable to sign out all devices.' });
    }
  });
}

module.exports = { mountAccount };
