import mongoose from "mongoose";

// An app the person has let into their account: Claude, through the connector (see utils/connector.js).
// One per "Allow". Its tokens are kept only as their SHA-256, like the app's own sessions.
// The person can end it from Settings; signing out everywhere, a new password and Claude itself can too.
const connectionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    clientId: {
        type: String,
        required: true,
    },
    // What Settings calls it
    clientName: {
        type: String,
        default: "Claude",
    },
    scope: {
        type: String,
        required: true,
    },
    // The MCP URL its tokens were granted for. A token is only good there.
    resource: {
        type: String,
        required: true,
    },
    accessToken: {
        type: String,
        required: true,
        unique: true,
    },
    accessExpiresAt: {
        type: Date,
        required: true,
    },
    refreshToken: {
        type: String,
        required: true,
        unique: true,
    },
    // The refresh token the current one replaced, and when. It still works for a short while (REFRESH_GRACE_MS),
    // so a refresh whose answer never reached Claude doesn't end the connection.
    previousRefreshToken: {
        type: String,
        default: null,
    },
    rotatedAt: {
        type: Date,
        default: null,
    },
    // Unless Claude refreshes before then, the connection lapses and the row is deleted soon after
    expiresAt: {
        type: Date,
        required: true,
        expires: 0,
    },
    // Updated at most every few minutes, for Settings
    lastUsedAt: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

connectionSchema.index(
    { previousRefreshToken: 1 },
    { partialFilterExpression: { previousRefreshToken: { $type: "string" } } },
);

const Connection = mongoose.model("Connection", connectionSchema);
export default Connection;
