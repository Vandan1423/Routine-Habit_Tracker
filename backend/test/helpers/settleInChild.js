// Run as a separate process by settlement.test.js: closes a user's ended days at a given moment.
// Several of these started together stand in for several server instances doing the same thing at once.
import "./env.js";

import mongoose from "mongoose";

import User from "../../src/models/User.js";
import { settleEndedDays } from "../../src/utils/dailyPenaltyJob.js";

const [userId, moment] = process.argv.slice(2);

await mongoose.connect(process.env.MONGO_URI_TEST);
await settleEndedDays(await User.findById(userId), new Date(moment));
await mongoose.disconnect();
