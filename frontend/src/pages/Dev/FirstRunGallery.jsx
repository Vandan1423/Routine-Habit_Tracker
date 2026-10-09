import { useState } from "react";
import { Link } from "react-router-dom";
import { Row, Section } from "./GalleryParts";
import SampleDay from "../Auth/SampleDay";
import FirstDay from "../Today/FirstDay";
import useNow from "../../hooks/useNow";
import { startersFailedWords } from "../../lib/starters";
import { toast } from "../../lib/toast";
import styles from "./GalleryPage.module.css";

// The fifth part of the gallery: what a visitor meets before the app, and a new account's first day.
// The pages a visitor signs in and up on are pages of their own, open to anyone signed out; they are
// linked here rather than drawn again.

const SAVING_MS = 1800;

const PAGES = [
    { to: "/login", label: "Sign in" },
    { to: "/signup", label: "Create an account" },
    { to: "/forgot-password", label: "Forgot password" },
    { to: "/reset-password/not-a-link", label: "A reset link that has run out" },
    { to: "/verify-email/not-a-link", label: "A confirmation link that did not work" },
];

const FirstRunGallery = () => {
    const now = useNow();
    const [busy, setBusy] = useState(false);
    const [round, setRound] = useState(0);

    // Nothing is saved here: the button works for a moment, then the offer starts over
    const start = (starters) => {
        setBusy(true);
        setTimeout(() => {
            setBusy(false);
            setRound((count) => count + 1);
            toast(`${starters.length} would be added`);
        }, SAVING_MS);
    };

    return (
        <>
            <Section
                title="Before signing in"
                note="Each is a page of its own, shown to a visitor who is not signed in. Sign out to see them."
            >
                <Row label="Pages">
                    {PAGES.map((page) => (
                        <Link key={page.to} to={page.to} className={styles.plainLink}>
                            {page.label}
                        </Link>
                    ))}
                </Row>
                <Row label="The sample day beside them">
                    <div className={styles.stage} inert>
                        <SampleDay />
                    </div>
                </Row>
            </Section>

            <Section
                title="A new account’s first day"
                note="Shown on Today in place of the list until something is chosen or the offer is put away."
            >
                <div className={styles.stage}>
                    <div className={styles.stagePad}>
                        <FirstDay
                            key={round}
                            now={now}
                            busy={busy}
                            onStart={start}
                            onSkip={() => toast("The plain empty state takes its place")}
                        />
                    </div>
                </div>
                <Row label="When saving fails">
                    {[
                        [0, 4],
                        [3, 1],
                        [2, 3],
                    ].map(([made, failed]) => {
                        const words = startersFailedWords(made, failed);

                        return (
                            <button
                                key={`${made}-${failed}`}
                                type="button"
                                className={styles.plainLink}
                                onClick={() =>
                                    toast.error(words.message, {
                                        detail: words.detail,
                                        action: { label: "Try again", onClick: () => {} },
                                    })
                                }
                            >
                                {made} saved, {failed} not
                            </button>
                        );
                    })}
                </Row>
            </Section>
        </>
    );
};

export default FirstRunGallery;
