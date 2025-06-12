import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

// Event types untuk subscription
export const EVENTS = {
  BOOKING: {
    CREATED: 'BOOKING_CREATED',
    UPDATED: 'BOOKING_UPDATED',
    EXPIRED: 'BOOKING_EXPIRED'
  },
  PAYMENT: {
    CREATED: 'PAYMENT_CREATED',
    UPDATED: 'PAYMENT_UPDATED'
  },
  SALDO: {
    UPDATED: 'SALDO_UPDATED'
  },
  CHAT: {
    SENT: 'CHAT_SENT',
    RECEIVED: 'CHAT_RECEIVED'
  },
  NOTIFICATION: {
    NEW: 'NOTIFICATION_NEW'
  }
};

/**
 * Publish event ke subscribers
 * @param {string} eventName - Nama event
 * @param {Object} payload - Data yang akan dikirim
 */
export const publish = async (eventName, payload) => {
  try {
    await pubsub.publish(eventName, payload);
  } catch (error) {
    console.error('❌ PubSub error:', error);
    throw new Error('Gagal mengirim notifikasi');
  }
};

/**
 * Subscribe ke event
 * @param {string} eventName - Nama event
 * @returns {AsyncIterator} Iterator untuk subscription
 */
export const subscribe = (eventName) => {
  return pubsub.asyncIterator(eventName);
};

/**
 * Filter subscription berdasarkan user ID
 * @param {string} userId - ID user yang akan menerima event
 * @returns {Function} Filter function
 */
export const withFilter = (userId) => {
  return (payload, variables, context) => {
    if (!context.user) return false;
    return payload.userId === context.user.id;
  };
}; 