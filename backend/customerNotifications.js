const { EFFECTIVE_AVAILABILITY_SQL } = require('./stockFreshness');

const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;

async function notifyStockAvailable(pool, productIds) {
  const ids = [...new Set((productIds || []).map(Number).filter(validId))];
  if (!ids.length) return 0;
  const result = await pool.query(
    `WITH subscribers AS (
       UPDATE product_stock_alerts
       SET active=FALSE, notified_at=CURRENT_TIMESTAMP
       WHERE active=TRUE AND product_id=ANY($1::int[])
       RETURNING user_id,product_id
     )
     INSERT INTO customer_notifications (user_id,product_id,shop_id,notification_type,title,message)
     SELECT a.user_id,p.id,p.shop_id,'stock_available',
            p.name || ' is available',
            p.name || ' was confirmed available at ' || s.name || '. Check with the shop before travelling.'
     FROM subscribers a
     JOIN products p ON p.id=a.product_id
     JOIN shops s ON s.id=p.shop_id
     RETURNING id`,
    [ids]
  );
  return result.rows.length;
}

function mountCustomerNotifications(app, pool, authenticate) {
  app.post('/api/products/:productId/stock-alert', authenticate, async (req, res) => {
    const productId = Number(req.params.productId);
    if (!validId(productId)) return res.status(400).json({ error: 'A valid product is required.' });
    try {
      const result = await pool.query(
        `INSERT INTO product_stock_alerts (user_id,product_id,active,created_at,notified_at)
         SELECT $1,p.id,TRUE,CURRENT_TIMESTAMP,NULL
         FROM products p JOIN shops s ON s.id=p.shop_id
         WHERE p.id=$2 AND s.subscription_ends_at>CURRENT_TIMESTAMP
           AND ${EFFECTIVE_AVAILABILITY_SQL}<>'available'
         ON CONFLICT (user_id,product_id) DO UPDATE
         SET active=TRUE,created_at=CURRENT_TIMESTAMP,notified_at=NULL
         RETURNING product_id`,
        [req.user.userId, productId]
      );
      if (!result.rows.length) return res.status(409).json({ error: 'This product is already confirmed available, or is no longer listed.' });
      return res.status(201).json({ message: 'We will notify you here when the shop confirms this product is available.', subscribed: true });
    } catch (error) {
      console.error('Stock alert subscription failed:', error.message);
      return res.status(500).json({ error: 'Unable to create this stock alert.' });
    }
  });

  app.delete('/api/products/:productId/stock-alert', authenticate, async (req, res) => {
    const productId = Number(req.params.productId);
    if (!validId(productId)) return res.status(400).json({ error: 'A valid product is required.' });
    try {
      await pool.query('UPDATE product_stock_alerts SET active=FALSE WHERE user_id=$1 AND product_id=$2', [req.user.userId, productId]);
      return res.json({ message: 'Stock alert removed.', subscribed: false });
    } catch (error) {
      return res.status(500).json({ error: 'Unable to remove this stock alert.' });
    }
  });

  app.get('/api/customer/notifications', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT n.id,n.notification_type,n.title,n.message,n.read_at,n.created_at,
                n.product_id,n.shop_id,p.name AS product_name,s.name AS shop_name,s.address,s.image_url
         FROM customer_notifications n
         LEFT JOIN products p ON p.id=n.product_id
         LEFT JOIN shops s ON s.id=n.shop_id
         WHERE n.user_id=$1
         ORDER BY n.created_at DESC,n.id DESC LIMIT 30`,
        [req.user.userId]
      );
      return res.set('Cache-Control', 'no-store').json({ notifications: result.rows, unread_count: result.rows.filter((item) => !item.read_at).length });
    } catch (error) {
      console.error('Customer notifications failed:', error.message);
      return res.status(500).json({ error: 'Unable to load notifications.' });
    }
  });

  app.patch('/api/customer/notifications/read', authenticate, async (req, res) => {
    try {
      await pool.query('UPDATE customer_notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND read_at IS NULL', [req.user.userId]);
      return res.json({ message: 'Notifications marked as read.' });
    } catch (error) {
      return res.status(500).json({ error: 'Unable to update notifications.' });
    }
  });

  app.patch('/api/customer/notifications/:notificationId/read', authenticate, async (req, res) => {
    const notificationId = Number(req.params.notificationId);
    if (!validId(notificationId)) return res.status(400).json({ error: 'A valid notification is required.' });
    try {
      await pool.query('UPDATE customer_notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=$1 AND user_id=$2', [notificationId, req.user.userId]);
      return res.json({ message: 'Notification marked as read.' });
    } catch (error) {
      return res.status(500).json({ error: 'Unable to update this notification.' });
    }
  });
}

module.exports = { mountCustomerNotifications, notifyStockAvailable };
