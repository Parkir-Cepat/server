import express from 'express';
import request from 'supertest';
import router from '../../../routes/webhook.js';
import { Transaction } from '../../../models/Transaction.js';
import { User } from '../../../models/User.js';

jest.mock('../../../models/Transaction.js');
jest.mock('../../../models/User.js');

describe('POST /midtrans Webhook', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', router);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MIDTRANS_SERVER_KEY = 'key';
  });

  const makeRequest = (body) => request(app).post('/midtrans').send(body);

  it('returns 404 when transaction not found', async () => {
    Transaction.findByTransactionId.mockResolvedValue(null);
    const res = await makeRequest({ order_id: 'o1', transaction_status: 'capture', fraud_status: 'accept', gross_amount: '10', signature_key: '' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Transaction not found' });
  });

  it('processes success top-up and updates user', async () => {
    const tx = { _id: 't1', status: 'pending', type: 'top-up', user_id: 'u1', amount: 100, transaction_id: 'o2' };
    Transaction.findByTransactionId.mockResolvedValue(tx);
    Transaction.updateStatus.mockResolvedValue({ ...tx, status: 'success' });
    User.updateSaldo.mockResolvedValue(true);
    Transaction.create.mockResolvedValue({});
    const res = await makeRequest({ order_id: 'o2', transaction_status: 'settlement', fraud_status: 'accept', gross_amount: '100', signature_key: '' });
    expect(res.status).toBe(200);
    expect(Transaction.updateStatus).toHaveBeenCalledWith('t1', 'success');
    expect(User.updateSaldo).toHaveBeenCalledWith('u1', 100);
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'saldo_credit' }));
    expect(res.body).toEqual({ status: 'OK' });
  });

  it('sets pending status and skips user update', async () => {
    const tx = { _id: 't2', status: 'other', type: 'purchase', user_id: 'u2', amount: 50, transaction_id: 'o3' };
    Transaction.findByTransactionId.mockResolvedValue(tx);
    Transaction.updateStatus.mockResolvedValue({ ...tx, status: 'pending' });
    const res = await makeRequest({ order_id: 'o3', transaction_status: 'pending', gross_amount: '50', signature_key: '' });
    expect(res.status).toBe(200);
    expect(Transaction.updateStatus).toHaveBeenCalledWith('t2', 'pending');
    expect(User.updateSaldo).not.toHaveBeenCalled();
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(res.body).toEqual({ status: 'OK' });
  });

  it('handles failed statuses and skips user update', async () => {
    const tx = { _id: 't3', status: 'pending', type: 'top-up', user_id: 'u3', amount: 30, transaction_id: 'o4' };
    Transaction.findByTransactionId.mockResolvedValue(tx);
    Transaction.updateStatus.mockResolvedValue({ ...tx, status: 'failed' });
    const res = await makeRequest({ order_id: 'o4', transaction_status: 'deny', gross_amount: '30', signature_key: '' });
    expect(res.status).toBe(200);
    expect(Transaction.updateStatus).toHaveBeenCalledWith('t3', 'failed');
    expect(User.updateSaldo).not.toHaveBeenCalled();
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(res.body).toEqual({ status: 'OK' });
  });

  it('returns 500 on unexpected error', async () => {
    Transaction.findByTransactionId.mockRejectedValue(new Error('err'));
    const res = await makeRequest({ order_id: 'o5', transaction_status: 'capture', gross_amount: '20', signature_key: '' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Webhook processing failed' });
  });
});
