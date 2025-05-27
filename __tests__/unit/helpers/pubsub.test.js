import * as pubsubHelper from '../../../helpers/pubsub.js';
import { PubSub } from 'graphql-subscriptions';

jest.mock('graphql-subscriptions', () => {
  const mPubSub = {
    publish: jest.fn(),
    asyncIterator: jest.fn()
  };
  return { PubSub: jest.fn(() => mPubSub) };
});

describe('pubsub helper', () => {
  let pubsubInstance;

  beforeEach(() => {
    pubsubInstance = new PubSub();
    pubsubInstance.publish.mockClear();
    pubsubInstance.asyncIterator.mockClear();
  });

  describe('publish', () => {
    it('should call pubsub.publish with correct args', async () => {
      await pubsubHelper.publish('EVENT_NAME', { data: 123 });
      expect(pubsubInstance.publish).toHaveBeenCalledWith('EVENT_NAME', { data: 123 });
    });
    it('should throw error if pubsub.publish fails', async () => {
      pubsubInstance.publish.mockRejectedValueOnce(new Error('fail'));
      await expect(pubsubHelper.publish('EVENT_NAME', {})).rejects.toThrow('Gagal mengirim notifikasi');
    });
  });

  describe('subscribe', () => {
    it('should call pubsub.asyncIterator with correct event', () => {
      pubsubHelper.subscribe('EVENT_NAME');
      expect(pubsubInstance.asyncIterator).toHaveBeenCalledWith('EVENT_NAME');
    });
  });

  describe('withFilter', () => {
    it('should return true if userId matches context', () => {
      const filter = pubsubHelper.withFilter('user123');
      const payload = { userId: 'user123' };
      const context = { user: { id: 'user123' } };
      expect(filter(payload, {}, context)).toBe(true);
    });
    it('should return false if context.user is missing', () => {
      const filter = pubsubHelper.withFilter('user123');
      const payload = { userId: 'user123' };
      const context = {};
      expect(filter(payload, {}, context)).toBe(false);
    });
    it('should return false if userId does not match', () => {
      const filter = pubsubHelper.withFilter('user123');
      const payload = { userId: 'user456' };
      const context = { user: { id: 'user123' } };
      expect(filter(payload, {}, context)).toBe(false);
    });
  });
}); 