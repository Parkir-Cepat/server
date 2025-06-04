import { createTransaction } from '../../../helpers/midtrans.js';
import midtransClient from 'midtrans-client';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('midtrans.createTransaction', () => {
  const originalEnv = process.env;
  let mongoServer;

  beforeAll(async () => {
    // Ensure MongoMemoryServer uses a valid port
    mongoServer = await MongoMemoryServer.create({ instance: { port: 27017 } });
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;
  });

  beforeEach(() => {
    jest.resetModules();
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_SERVER_KEY = 'key';
  });

  it('returns QRIS response when CoreApi charge includes qr_string', async () => {
    // Mock CoreApi.charge
    const mockCharge = jest.fn().mockResolvedValue({ qr_string: '000201010212264893600016ID.CO.QRIS.WWW0215ID20232090059510303UMI52045999530336054031005802ID5906PARKGO6007JAKARTA62060102t163043C2A', transaction_id: 'tid', redirect_url: 'url', transaction_status: 'pending' });
    jest.spyOn(midtransClient, 'CoreApi').mockImplementation(() => ({ charge: mockCharge }));

    const res = await createTransaction({ transactionId: 't1', amount: 100, customerName: 'C', customerEmail: 'e', paymentType: 'qris' });
    expect(res.qrCode).toBe('000201010212264893600016ID.CO.QRIS.WWW0215ID20232090059510303UMI52045999530336054031005802ID5906PARKGO6007JAKARTA62060102t163043C2A');
    expect(res.transaction_status).toBe('pending');
  });

  it('falls back to Snap on CoreApi failure and returns pending', async () => {
    const mockCharge = jest.fn().mockRejectedValue(new Error('fail'));
    const mockSnap = { createTransaction: jest.fn().mockResolvedValue({ token: 't2', redirect_url: 'ru' }) };
    jest.spyOn(midtransClient, 'CoreApi').mockImplementation(() => ({ charge: mockCharge }));
    jest.spyOn(midtransClient, 'Snap').mockImplementation(() => mockSnap);

    const res = await createTransaction({ transactionId: 't2', amount: 200, customerName: 'C', customerEmail: 'e', paymentType: 'qris' });
    expect(res.token).toBe('t2');
    expect(res.transaction_status).toBe('pending');
  });
});
