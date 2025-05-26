import { userTypes } from './userTypes.js';
import { parkingLotTypes } from './parkingLotTypes.js';
import { bookingTypes } from './bookingTypes.js';
import { paymentTypes } from './paymentTypes.js';
import { chatTypes } from './chatTypes.js';

const typeDefs = `#graphql
  ${userTypes}
  ${parkingLotTypes}
  ${bookingTypes}
  ${paymentTypes}
  ${chatTypes}
`;

export default typeDefs; 