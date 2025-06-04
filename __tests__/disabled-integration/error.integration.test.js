// Integration tests for error handling and API contract scenarios
import request from 'supertest';
const { app } = require('../../index.js');

describe('API Error Handling Integration', () => {
  it('should return error for invalid GraphQL query', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: `query { nonExistentField }` });
    expect(res.body.errors[0].message).toMatch(/Cannot query field/);
  });

  it('should return authentication error for protected mutation', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `mutation { cancelBooking(id: "fakeid") { _id status } }`
      });
    expect(res.body.errors[0].message).toMatch(/login terlebih dahulu/);
  });

  it('should return validation error for missing required fields', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `mutation { register(input: { email: "", password: "", name: "" }) { _id email } }`
      });
    expect(res.body.errors[0].message).toMatch(/invalid/i);
  });
});
