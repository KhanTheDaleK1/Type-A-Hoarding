import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  type_a_hoarding_db: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// --- Authentication (Personal use - simplified) ---
app.post('/auth/register', async (c) => {
  const { email, password } = await c.req.json();
  const userId = crypto.randomUUID();
  
  await c.env.type_a_hoarding_db.prepare(
    'INSERT INTO users (id, email, password) VALUES (?, ?, ?)'
  ).bind(userId, email, password).run();
  
  return c.json({ success: true, userId });
});

app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.type_a_hoarding_db.prepare(
    'SELECT id FROM users WHERE email = ? AND password = ?'
  ).bind(email, password).first();
  
  if (user) {
    return c.json({ success: true, token: 'fake-jwt-token', userId: user.id });
  }
  return c.json({ success: false }, 401);
});

// --- Sync (Manual Backup Logic) ---
// Note: Images are now stored as Base64 strings inside the 'data' JSON blob
app.post('/sync/push', async (c) => {
  const { userId, collections, items } = await c.req.json();
  
  await c.env.type_a_hoarding_db.prepare('DELETE FROM collections WHERE userId = ?').bind(userId).run();
  await c.env.type_a_hoarding_db.prepare('DELETE FROM items WHERE userId = ?').bind(userId).run();
  
  const collectionBatch = collections.map((coll: any) => 
    c.env.type_a_hoarding_db.prepare('INSERT INTO collections (id, userId, name, type, data) VALUES (?, ?, ?, ?, ?)')
      .bind(coll.id, userId, coll.name, coll.type, JSON.stringify(coll))
  );

  const itemBatch = items.map((item: any) => 
    c.env.type_a_hoarding_db.prepare('INSERT INTO items (id, userId, collectionId, title, data) VALUES (?, ?, ?, ?, ?)')
      .bind(item.id, userId, item.collectionId, item.title, JSON.stringify(item))
  );

  await c.env.type_a_hoarding_db.batch([...collectionBatch, ...itemBatch]);
  
  return c.json({ success: true, timestamp: Date.now() });
});

app.get('/sync/pull', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  const collections = await c.env.type_a_hoarding_db.prepare('SELECT data FROM collections WHERE userId = ?').bind(userId).all();
  const items = await c.env.type_a_hoarding_db.prepare('SELECT data FROM items WHERE userId = ?').bind(userId).all();
  
  return c.json({
    collections: collections.results.map(r => JSON.parse(r.data as string)),
    items: items.results.map(r => JSON.parse(r.data as string))
  });
});

export default app;
