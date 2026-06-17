import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

const serverModule = await import('./server.js');
const app = serverModule.default || serverModule;
const pool = serverModule.pool;

let originalQuery;

beforeEach(() => {
  originalQuery = pool.query;
});

afterEach(() => {
  pool.query = originalQuery;
});

describe('Server app basic routes', () => {
  test('GET / redirige vers /api-docs', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/api-docs');
  });

  test('GET /api-docs renvoie du HTML', async () => {
    const res = await request(app).get('/api-docs/').redirects(1);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

describe('Server app 404 et historique', () => {
  test("GET /history/:accountId renvoie 404 quand le compte n'existe pas", async () => {
    pool.query = async () => ({ rows: [] });
    const res = await request(app).get('/history/999');
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Compte non trouvé', status: 404 });
  });

  test('Route inconnue renvoie un 404 JSON', async () => {
    const res = await request(app).get('/route-inconnue');
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Endpoint non trouvé', status: 404 });
  });
});
