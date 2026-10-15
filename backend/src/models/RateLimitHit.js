import mongoose from "mongoose";

// One rate limit's count for one key (an address, an account), for the window it is in.
// _id is the limit's prefix and the key together ("login:account:someone@example.com").
// Used where the app runs as several copies at once (Vercel), so every copy counts against the same budget.
const rateLimitHitSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    hits: {
        type: Number,
        required: true,
    },
    // When the window ends; the row is deleted soon after
    resetAt: {
        type: Date,
        required: true,
        expires: 0,
    },
});

const RateLimitHit = mongoose.model("RateLimitHit", rateLimitHitSchema);
export default RateLimitHit;
