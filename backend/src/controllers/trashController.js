import { DEFAULT_TRASH_DAYS } from "../utils/trash.js";
import { purgeExpiredTrash, TRASH_KINDS } from "../utils/trashKinds.js";

// Trash: everything the user has deleted, of every kind, in one place, until its time runs out.

// @desc    What is in Trash, the most recently deleted first
// @route   GET /api/trash
export const getTrash = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Anything whose time has run out goes first, so the list never offers what can no longer be had.
        // The background sweep does the same for everyone; this covers a server that was asleep.
        await purgeExpiredTrash({ userId });

        const found = await Promise.all(
            Object.entries(TRASH_KINDS).map(async ([kind, { find, describe }]) =>
                (await find(userId)).map((doc) => ({
                    kind,
                    id: doc._id,
                    deletedAt: doc.deletedAt,
                    purgeAt: doc.purgeAt,
                    ...describe(doc),
                })),
            ),
        );

        res.status(200).json({
            days: req.user.trashDays || DEFAULT_TRASH_DAYS,
            items: found.flat().sort((a, b) => b.deletedAt - a.deletedAt),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Bring one thing back from Trash, exactly as it was
// @route   POST /api/trash/:kind/:id/restore
export const restoreTrashed = async (req, res, next) => {
    try {
        const { kind, id } = req.params;
        const restored = await TRASH_KINDS[kind].restore(req.user, id);

        if (!restored) {
            return res.status(404).json({ message: "That is no longer in Trash." });
        }
        if (restored.refused) {
            return res.status(409).json({ message: restored.refused });
        }

        res.status(200).json({
            kind,
            id,
            item: restored.item,
            xpReturned: restored.xpReturned ?? 0,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Let go of one thing in Trash for good
// @route   DELETE /api/trash/:kind/:id
export const eraseTrashed = async (req, res, next) => {
    try {
        const { kind, id } = req.params;
        const gone = await TRASH_KINDS[kind].erase({ _id: id, user: req.user._id });

        if (gone === 0) {
            return res.status(404).json({ message: "That is no longer in Trash." });
        }

        res.status(200).json({ kind, id });
    } catch (error) {
        next(error);
    }
};

// @desc    Let go of everything in Trash for good
// @route   DELETE /api/trash
export const emptyTrash = async (req, res, next) => {
    try {
        let gone = 0;
        for (const kind of Object.values(TRASH_KINDS)) {
            gone += await kind.erase({ user: req.user._id });
        }

        res.status(200).json({ erased: gone });
    } catch (error) {
        next(error);
    }
};
