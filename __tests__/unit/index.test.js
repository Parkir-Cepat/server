import request from 'supertest';
import { app } from '../../index.js';

describe('Server index.js', () => {
  it('responds with 404 on unknown route', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('should initialize the server without errors', async () => {
    const response = await request(app).get('/'); // Assuming root route exists
    expect(response.status).toBe(200);
  });
});
