import { useState } from "react";
import Brand from "../../components/shell/Brand";
import LevelIndicator from "../../components/shell/LevelIndicator";
import PageSkeleton from "../../components/shell/PageSkeleton";
import ScreenError from "../../components/shell/ScreenError";
import Waking from "../../components/shell/Waking";
import { Button, NavTabs, SegmentedControl } from "../../components/ui";
import { Row, Section } from "./GalleryParts";
import styles from "./GalleryPage.module.css";

// The third part of the gallery: what the shell is made of, and the states it shows when there is no screen to show.
// The shell itself (sidebar, rail, tab bar) is seen by opening the app at each width.

const LEVEL_LENGTH = 500;

const WAITS = [
    { value: 4, label: "4 s" },
    { value: 14, label: "14 s" },
    { value: 31, label: "31 s" },
    { value: 70, label: "70 s" },
];

const TABS = [
    { to: "/dev/ui", label: "Routines", end: true },
    { to: "/dev/ui/habits", label: "Habits" },
    { to: "/dev/ui/archive", label: "Archive" },
];

const FAILED_DOWNLOAD = new Error("Failed to fetch dynamically imported module: /assets/InsightsPage.js");
const BROKEN_SCREEN = new Error("Cannot read properties of undefined (reading 'map')");

const ShellGallery = () => {
    const [xp, setXp] = useState(340);
    const [waited, setWaited] = useState(14);

    const level = 7 + Math.floor(xp / LEVEL_LENGTH);
    const intoLevel = ((xp % LEVEL_LENGTH) + LEVEL_LENGTH) % LEVEL_LENGTH;

    return (
        <>
            <Section title="Name" note="The mark is three Day Strip segments, the last still to be filled.">
                <Row label="Full">
                    <Brand />
                </Row>
                <Row label="Mark only">
                    <Brand markOnly />
                </Row>
            </Section>

            <Section
                title="Level"
                note="At the foot of the sidebar. The number counts and the bar slides; neither jumps."
            >
                <Row label="Sidebar">
                    <div className={styles.sidebarWidth}>
                        <LevelIndicator level={level} currentXp={intoLevel} xpForNext={LEVEL_LENGTH} />
                    </div>
                    <Button size="sm" onClick={() => setXp(xp + 15)}>
                        Earn 15
                    </Button>
                    <Button size="sm" onClick={() => setXp(Math.max(xp - 15, 0))}>
                        Lose 15
                    </Button>
                    <Button size="sm" onClick={() => setXp(xp + 200)}>
                        Earn 200
                    </Button>
                </Row>
                <Row label="Loading">
                    <div className={styles.sidebarWidth}>
                        <LevelIndicator loading />
                    </div>
                </Row>
                <Row label="Rail">
                    <LevelIndicator compact level={level} currentXp={intoLevel} xpForNext={LEVEL_LENGTH} />
                    <LevelIndicator compact loading />
                </Row>
            </Section>

            <Section
                title="Link tabs"
                note="For the parts of one screen that each have an address. The second and third lead here too."
            >
                <NavTabs label="Example" items={TABS} />
            </Section>

            <Section
                title="Waiting"
                note="A screen on its way is a skeleton. A first request that is slow says why, and counts the half minute."
            >
                <Row label="Screen">
                    <div className={styles.stage}>
                        <PageSkeleton delayed={false} />
                    </div>
                </Row>
                <Row label="Waking">
                    <SegmentedControl
                        label="Seconds waited"
                        options={WAITS}
                        value={waited}
                        onChange={setWaited}
                    />
                </Row>
                <Row label="">
                    <div className={styles.stage}>
                        <div className={styles.stagePad}>
                            <Waking key={waited} elapsed={waited} />
                        </div>
                    </div>
                </Row>
            </Section>

            <Section
                title="When a screen fails"
                note="The navigation stays; only the screen is replaced. The grey box is shown in development only."
            >
                <Row label="Download">
                    <div className={styles.stage}>
                        <div className={styles.stagePad}>
                            <ScreenError error={FAILED_DOWNLOAD} />
                        </div>
                    </div>
                </Row>
                <Row label="Render">
                    <div className={styles.stage}>
                        <div className={styles.stagePad}>
                            <ScreenError error={BROKEN_SCREEN} />
                        </div>
                    </div>
                </Row>
            </Section>
        </>
    );
};

export default ShellGallery;
