CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT,
  type TEXT,
  data TEXT,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  userId TEXT,
  collectionId TEXT,
  title TEXT,
  data TEXT,
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(collectionId) REFERENCES collections(id)
);
