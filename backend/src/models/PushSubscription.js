import mongoose from "mongoose";

// One browser or phone that has agreed to be sent reminders for an account (the Web Push API's subscription).
// The endpoint is where the push service takes messages for that device; the two keys encrypt them for it.
const pushSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    endpoint: {
        type: String,
        required: true,
        unique: true,
    },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
export default PushSubscription;
