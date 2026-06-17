-- init.sql: create tables for Bank API

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  operation TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_balance NUMERIC(18,2),
  new_balance NUMERIC(18,2)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
