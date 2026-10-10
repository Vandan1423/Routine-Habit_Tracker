// Things shown before the server has answered for them. Until it does, each goes by an id made here;
// afterwards the row it was drawn in keeps the key it had, so nothing on screen moves when the server's
// id takes over. Kept for the session, like what has been read from the API.

const rowKeys = new Map();
let made = 0;

// An id for something of this kind that only this screen knows of yet
export const newDraftId = (kind) => {
    made += 1;
    return `draft:${kind}:${made}`;
};

export const isDraftId = (id) => String(id ?? "").startsWith("draft:");

// The server has saved a draft: its row keeps the key it was first drawn under
export const adoptDraft = (draftId, savedId) => {
    rowKeys.set(String(savedId), draftId);
};

// What a row is told apart by, given the id of what it shows
export const rowKeyOf = (id) => rowKeys.get(String(id)) ?? id;
