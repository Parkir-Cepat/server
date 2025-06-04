import { userTypes } from "./userTypes.js";
import { parkingTypes } from "./parkingTypes.js";
import { bookingTypes } from "./bookingTypes.js";
import { roomTypes } from "./roomTypes.js";
import { chatTypes } from "./chatTypes.js";
import { notificationTypes } from "./notificationTypes.js";
import { transactionTypeDefs } from "./transactionTypeDefs.js";

import { mergeTypeDefs } from "@graphql-tools/merge";

const typeDefs = mergeTypeDefs([
  userTypes,
  parkingTypes,
  bookingTypes,
  transactionTypeDefs,
  roomTypes,
  chatTypes,
  notificationTypes,
]);

export default typeDefs;

parkingsByOwner(ownerId: ID): [Parking]
