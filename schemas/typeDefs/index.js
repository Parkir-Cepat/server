import { userTypes } from './userTypes.js';
import { parkingLotTypes } from './parkingLotTypes.js';
import { bookingTypes } from './bookingTypes.js';
import { paymentTypes } from './paymentTypes.js';
import { chatTypes } from './chatTypes.js';
import { notificationTypes } from './notificationTypes.js';

const typeDefs = `#graphql
  ${userTypes}
  ${parkingLotTypes}
  ${bookingTypes}
  ${paymentTypes}
  ${chatTypes}
  ${notificationTypes}
`;

export default typeDefs; 