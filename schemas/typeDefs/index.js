import { userTypes } from './userTypes.js';
import { parkingTypes } from './parkingTypes.js';
import { bookingTypes } from './bookingTypes.js';
import { transactionTypes } from './transactionTypes.js';
import { roomTypes } from './roomTypes.js';
import { chatTypes } from './chatTypes.js';
import { notificationTypes } from './notificationTypes.js';

const typeDefs = `#graphql
  ${userTypes}
  ${parkingTypes}
  ${bookingTypes}
  ${transactionTypes}
  ${roomTypes}
  ${chatTypes}
  ${notificationTypes}
`;

export default typeDefs;