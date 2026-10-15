import { useEffect, useState } from "react";
import Waking from "./Waking";
import useElapsedSeconds from "../../hooks/useElapsedSeconds";
import { cx } from "../../lib/cx";
import { endLaunch, launchHeld, subscribeLaunch } from "../../lib/launch";
import { DURATION } from "../../lib/motion";
import styles from "./Launch.module.css";

const Opening = ({ onGone }) => {
    const elapsed = useElapsedSeconds();
    const [answered, setAnswered] = useState(false);
    const [leaving, setLeaving] = useState(false);

    // Over once nothing holds the app back. Judged a moment after each change, because one holder can hand
    // over to the next within a single render (the session check, then the screen's own wait).
    useEffect(() => {
        let timer;
        const judge = () => {
            clearTimeout(timer);
            timer = setTimeout(() => setAnswered((was) => was || !launchHeld()), 0);
        };

        const stop = subscribeLaunch(judge);
        judge();
        return () => {
            stop();
            clearTimeout(timer);
        };
    }, []);

    // The fade is timed rather than awaited: a tab in the background runs no transitions
    useEffect(() => {
        if (!leaving) return undefined;

        const timer = setTimeout(() => {
            endLaunch();
            onGone();
        }, DURATION.base * 1000);
        return () => clearTimeout(timer);
    }, [leaving, onGone]);

    return (
        <div className={cx(styles.launch, leaving && styles.leaving)}>
            <Waking centred elapsed={elapsed} answered={answered} onWritten={() => setLeaving(true)} />
        </div>
    );
};

/**
 * The opening screen: नित्यक्रम being written, over everything from the first paint until the app knows who is
 * signed in. index.html draws its first frame (the name not yet written, in the same place) before the code arrives.
 * Usually the wait is under a second, and the name is finished in one quick stroke, or not at all if the wait was
 * over before the first letter began. After a rest the server takes about half a minute to wake, and the letters
 * are written over that time. Once gone, it does not come back for the rest of the visit.
 */
const Launch = () => {
    const [gone, setGone] = useState(false);

    if (gone) return null;

    return <Opening onGone={() => setGone(true)} />;
};

export default Launch;
