import mongoose from "mongoose";

// What "Allow" hands Claude on its way back: a code it trades for its tokens within minutes, once.
// _id is the code's SHA-256, so the trade is a single lookup and the code itself is never stored.
const authorizationCodeSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
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
    redirectUri: {
        type: String,
        required: true,
    },
    // PKCE: the trade must bring the verifier this was made from (S256)
    codeChallenge: {
        type: String,
        required: true,
    },
    scope: {
        type: String,
        required: true,
    },
    resource: {
        type: String,
        required: true,
    },
    // Deleted soon after, if it was never traded
    expiresAt: {
        type: Date,
        required: true,
        expires: 0,
    },
});

const AuthorizationCode = mongoose.model("AuthorizationCode", authorizationCodeSchema);
export default AuthorizationCode;
