DROP TABLE IF EXISTS files;

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  key TEXT,
  name TEXT,
  size INTEGER,
  type TEXT,
  uploadedAt INTEGER,
  url TEXT
);