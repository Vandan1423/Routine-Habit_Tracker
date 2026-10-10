// A request that makes something can be sent twice: the answer to the first got lost on the way, or the
// app sent it again when it opened next. So that the thing is still made once, the client gives each new
// thing a key of its own (the Idempotency-Key header) and the server keeps the key with what it made.

// The key a request carries, if it carries one that looks like one
export const keyOf = (req) => {
    const key = req.get("Idempotency-Key");
    return typeof key === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(key) ? key : undefined;
};

// For the schema of anything made this way: the key, and the rule that an account uses a key once
export const madeOnce = (schema) => {
    schema.add({ clientKey: { type: String, select: false } });
    schema.index(
        { user: 1, clientKey: 1 },
        { unique: true, partialFilterExpression: { clientKey: { $type: "string" } } },
    );
};

/**
 * Saves a new document, unless this account has already saved one under the same key.
 * @param {Document} doc - new, not saved yet, with its `user` set
 * @param {String} [key] - from keyOf; without one it is simply saved
 * @returns {Object} - doc: what is saved (the earlier one, for a request sent again);
 *   repeated: true when it was already there, so whatever follows from making it has been done before
 */
export const saveOnce = async (doc, key) => {
    if (!key) {
        await doc.save();
        return { doc, repeated: false };
    }

    doc.clientKey = key;
    try {
        await doc.save();
        return { doc, repeated: false };
    } catch (error) {
        if (error.code !== 11000 || !error.keyPattern?.clientKey) throw error;

        const earlier = await doc.constructor.findOne({ user: doc.user, clientKey: key });
        if (!earlier) throw error;
        return { doc: earlier, repeated: true };
    }
};
