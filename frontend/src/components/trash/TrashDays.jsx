import { useState } from "react";
import SegmentedControl from "../ui/SegmentedControl";
import useAuth from "../../hooks/useAuth";
import { toast } from "../../lib/toast";
import { DEFAULT_TRASH_DAYS, TRASH_DAYS_OPTIONS } from "../../lib/trashWords";

/**
 * How long Trash keeps what is deleted: one day, three days or a week. The choice is the account's,
 * so it is the same on every device; it is shown as chosen at once and put back if the save fails.
 */
const TrashDays = ({ className }) => {
    const { user, updateProfile } = useAuth();
    const saved = user?.trashDays ?? DEFAULT_TRASH_DAYS;
    // What was just chosen, until the account itself says the same
    const [chosen, setChosen] = useState(null);

    const choose = async (days) => {
        if (days === saved) return;

        setChosen(days);
        try {
            await updateProfile({ trashDays: days });
        } catch {
            toast.error("That didn’t save. Check your connection and try again.");
        } finally {
            setChosen(null);
        }
    };

    return (
        <SegmentedControl
            className={className}
            label="Keep deleted things for"
            options={TRASH_DAYS_OPTIONS}
            value={chosen ?? saved}
            onChange={choose}
        />
    );
};

export default TrashDays;
