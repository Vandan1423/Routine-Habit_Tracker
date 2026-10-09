import { useState } from "react";
import useAppearance from "../../hooks/useAppearance";
import useMediaQuery from "../../hooks/useMediaQuery";
import {
    AnimatedNumber,
    Button,
    Checkbox,
    Icon,
    IconButton,
    Input,
    Kbd,
    Loader,
    PasswordInput,
    ProgressBar,
    SegmentedControl,
    Skeleton,
    Switch,
    Textarea,
} from "../../components/ui";
import { ICONS } from "../../components/ui/icons";
import { THEME_OPTIONS } from "../../lib/appearance";
import { cx } from "../../lib/cx";
import DayGallery from "./DayGallery";
import FirstRunGallery from "./FirstRunGallery";
import { Row, Section } from "./GalleryParts";
import OverlaysGallery from "./OverlaysGallery";
import ShellGallery from "./ShellGallery";
import styles from "./GalleryPage.module.css";

// Every shared control in every state, on one page. Development only (see App.jsx): open /dev/ui.
// A new control, or a new state of one, is added here before it is used on a real screen.

const COLOURS = [
    ["paper", "Paper"],
    ["paper-side", "Sidebar"],
    ["raised", "Raised"],
    ["hover", "Hover"],
    ["fill", "Fill"],
    ["fill-strong", "Fill strong"],
    ["line", "Line"],
    ["line-strong", "Line strong"],
    ["ink", "Ink"],
    ["ink-2", "Ink 2"],
    ["ink-3", "Ink 3"],
    ["accent-soft", "Accent soft"],
    ["now", "Now"],
    ["late", "Late"],
    ["loss", "Loss"],
];

const STARTING_ITEMS = [
    { id: "meditate", title: "Meditation", meta: "10 min", xp: 15, done: true },
    { id: "read", title: "Read", unit: "pages", target: 20, amount: 12, xp: 15, done: false },
    { id: "journal", title: "Journal", meta: "Evening", xp: 15, done: false },
];
const XP_BEFORE_TODAY = 340;
const XP_FOR_LEVEL = 500;

// The controls working as one, on three made-up items
const Together = ({ loading }) => {
    const [items, setItems] = useState(STARTING_ITEMS);

    const done = items.filter((item) => item.done);
    const earned = done.reduce((sum, item) => sum + item.xp, 0);
    const next = items.find((item) => !item.done);

    const update = (id, change) =>
        setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, ...change(item) } : item)),
        );

    const toggle = (id) =>
        update(id, (item) => {
            const nowDone = !item.done;
            if (!item.target) return { done: nowDone };
            return { done: nowDone, amount: nowDone ? item.target : item.target - 1 };
        });

    const step = (id, by) =>
        update(id, (item) => {
            const amount = Math.min(Math.max(item.amount + by, 0), item.target);
            return { amount, done: amount === item.target };
        });

    if (loading) {
        return (
            <div className={styles.together} aria-busy="true">
                <div className={styles.togetherTop}>
                    <Skeleton variant="text" width="9ch" />
                    <Skeleton variant="text" width="11ch" />
                </div>
                <Skeleton height={6} className={styles.togetherBar} />
                <ul className={styles.items}>
                    {STARTING_ITEMS.map((item) => (
                        <li key={item.id} className={styles.item}>
                            <Skeleton className={styles.itemCheckSkeleton} />
                            <span className={styles.itemMain}>
                                <Skeleton variant="text" width={`${item.title.length + 2}ch`} />
                            </span>
                            <Skeleton variant="text" width="3ch" />
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div className={styles.together}>
            <div className={styles.togetherTop}>
                <span className={styles.count}>
                    <b>
                        <AnimatedNumber value={done.length} />
                    </b>{" "}
                    of {items.length} done
                </span>
                <span className={styles.count}>
                    Level 7 ·{" "}
                    <b>
                        <AnimatedNumber mode="count" value={XP_BEFORE_TODAY + earned} />
                    </b>{" "}
                    / {XP_FOR_LEVEL} XP
                </span>
            </div>
            <ProgressBar
                className={styles.togetherBar}
                size="md"
                value={done.length}
                max={items.length}
                label="Items done"
            />
            <ul className={styles.items}>
                {items.map((item) => (
                    <li key={item.id} className={cx(styles.item, item.done && styles.itemDone)}>
                        <Checkbox
                            checked={item.done}
                            progress={item.target ? item.amount / item.target : 0}
                            tone={item === next ? "next" : undefined}
                            onChange={() => toggle(item.id)}
                            aria-label={`Complete ${item.title}`}
                        />
                        <span className={styles.itemMain}>
                            <span className={styles.itemTitle}>{item.title}</span>
                            <span className={styles.itemMeta}>
                                {item.target
                                    ? `${item.amount} of ${item.target} ${item.unit}`
                                    : item.meta}
                                {item === next && <b className={styles.itemNext}> · Next</b>}
                            </span>
                        </span>
                        {item.target && !item.done && (
                            <span className={styles.stepper}>
                                <IconButton
                                    icon="minus"
                                    label={`One less of ${item.title}`}
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => step(item.id, -1)}
                                />
                                <IconButton
                                    icon="plus"
                                    label={`One more of ${item.title}`}
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => step(item.id, 1)}
                                />
                            </span>
                        )}
                        <span className={styles.itemStake}>+{item.xp}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const GalleryPage = () => {
    const { theme, setTheme, motion, setMotion } = useAppearance();
    const isPhone = useMediaQuery("(max-width: 699.98px)");

    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("Morning pages");
    const [nameTouched, setNameTouched] = useState(false);
    const [note, setNote] = useState("");
    const [view, setView] = useState("week");
    const [reminders, setReminders] = useState(true);
    const [weekends, setWeekends] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [progress, setProgress] = useState(3);
    const [loading, setLoading] = useState(false);

    const save = () => {
        setSaving(true);
        setTimeout(() => setSaving(false), 1600);
    };

    const nameError = nameTouched && !name.trim() ? "Give it a name." : undefined;

    return (
        <div className={styles.page}>
            <header className={styles.bar}>
                <div className={styles.brand}>
                    <span className={styles.mark} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </span>
                    <span>Nitya</span>
                    <span className={styles.barNote}>Controls</span>
                </div>
                <div className={styles.barControls}>
                    <Switch
                        label="Reduce motion"
                        checked={motion === "reduce"}
                        onChange={(event) => setMotion(event.target.checked ? "reduce" : "system")}
                    />
                    <SegmentedControl
                        label="Theme"
                        options={THEME_OPTIONS}
                        value={theme}
                        onChange={setTheme}
                        iconOnly={isPhone}
                    />
                </div>
            </header>

            <main className={styles.main}>
                <header className={styles.intro}>
                    <h1 className={styles.introTitle}>The parts every screen is built from</h1>
                    <p className={styles.introText}>
                        Each control is shown in each of its states. Use them: hover, press, tab through
                        with the keyboard, switch the theme. Nothing here should look like the browser
                        drew it.
                    </p>
                </header>

                <Section
                    title="Together"
                    note="Check an item, or count one up. The number, the bar and the XP follow in the same moment."
                >
                    <Together loading={loading} />
                    <Row>
                        <Switch
                            label="Show it loading"
                            checked={loading}
                            onChange={(event) => setLoading(event.target.checked)}
                        />
                    </Row>
                </Section>

                <Section title="Colour" note="Ink is the accent. Saffron means now or next. Red means a loss.">
                    <ul className={styles.swatches}>
                        {COLOURS.map(([token, label]) => (
                            <li key={token} className={styles.swatch}>
                                <span
                                    className={styles.swatchColour}
                                    style={{ background: `var(--${token})` }}
                                />
                                <span className={styles.swatchName}>{label}</span>
                                <code className={styles.swatchToken}>--{token}</code>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Type" note="Hanken Grotesk for the interface. Newsreader for the date and nothing else.">
                    <ul className={styles.typeList}>
                        <li>
                            <span className={styles.typeDate}>Friday, 9 October</span>
                            <small>Date</small>
                        </li>
                        <li>
                            <span className={styles.typeHeading}>Your day starts here</span>
                            <small>Heading</small>
                        </li>
                        <li>
                            <span className={styles.typeItem}>Plan tomorrow</span>
                            <small>Item</small>
                        </li>
                        <li>
                            <span>Half the day is done. Deep work is next, at 2:00.</span>
                            <small>Body</small>
                        </li>
                        <li>
                            <span className={styles.typeMeta}>2:00 to 4:00 pm</span>
                            <small>Meta</small>
                        </li>
                        <li>
                            <span className={styles.typeNumerals}>
                                0123456789
                                <br />
                                1111111111
                            </span>
                            <small>Numerals</small>
                        </li>
                    </ul>
                </Section>

                <Section title="Icons" note="One set, drawn for this app on a 20px grid with one stroke weight.">
                    <ul className={styles.icons}>
                        {Object.keys(ICONS).map((iconName) => (
                            <li key={iconName} className={styles.iconCell}>
                                <Icon name={iconName} size={20} />
                                <span>{iconName}</span>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Buttons">
                    <Row label="Kinds">
                        <Button variant="primary">Add habit</Button>
                        <Button>Cancel</Button>
                        <Button variant="ghost">Skip</Button>
                        <Button variant="danger">Delete</Button>
                    </Row>
                    <Row label="Sizes">
                        <Button variant="primary" size="sm">
                            Small
                        </Button>
                        <Button variant="primary">Medium</Button>
                        <Button variant="primary" size="lg">
                            Large
                        </Button>
                    </Row>
                    <Row label="With more">
                        <Button variant="ghost" icon="plus" trailing={<Kbd>N</Kbd>}>
                            New
                        </Button>
                        <Button icon="undo">Undo</Button>
                        <Button variant="primary" trailing={<Kbd keys="mod+enter" />}>
                            Save
                        </Button>
                    </Row>
                    <Row label="Working">
                        <Button variant="primary" loading={saving} onClick={save}>
                            Save changes
                        </Button>
                        <Button loading>Saving</Button>
                    </Row>
                    <Row label="Disabled">
                        <Button variant="primary" disabled>
                            Add habit
                        </Button>
                        <Button disabled>Cancel</Button>
                        <Button variant="ghost" disabled>
                            Skip
                        </Button>
                    </Row>
                    <Row label="Icon only">
                        <IconButton icon="more" label="More" />
                        <IconButton icon="edit" label="Edit" />
                        <IconButton icon="close" label="Close" size="sm" />
                        <IconButton icon="plus" label="New item" variant="secondary" />
                        <IconButton icon="plus" label="New item" variant="secondary" size="lg" />
                        <IconButton icon="trash" label="Delete" disabled />
                    </Row>
                </Section>

                <Section title="Fields">
                    <div className={styles.fields}>
                        <Input
                            label="Name"
                            hint="Up to 120 characters."
                            error={nameError}
                            value={name}
                            maxLength={120}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={() => setNameTouched(true)}
                            placeholder="What do you want to do every day?"
                        />
                        <Input
                            label="Target"
                            type="number"
                            inputMode="numeric"
                            defaultValue={20}
                            trailing="pages"
                        />
                        <Input
                            label="Email"
                            type="email"
                            defaultValue="maya@example"
                            error="That doesn’t look like an email address."
                        />
                        <Input label="Timezone" defaultValue="Asia/Kolkata" disabled />
                        <PasswordInput
                            label="Password"
                            hint="The eye shows what was typed."
                            autoComplete="off"
                            defaultValue="correct horse"
                        />
                        <Input
                            aria-label="Jump to"
                            leading="search"
                            placeholder="Jump to…"
                            trailing={<Kbd keys="mod+k" />}
                        />
                        <Textarea
                            label="Note"
                            placeholder="Anything worth remembering about today"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                        />
                    </div>
                </Section>

                <Section
                    title="The check"
                    note="The same control completes an item on Today and ticks a box in a form."
                >
                    <Row label="States">
                        <Checkbox label="Open" checked={false} readOnly />
                        <Checkbox label="Next" tone="next" checked={false} readOnly />
                        <Checkbox label="Partly" progress={0.62} checked={false} readOnly />
                        <Checkbox label="Done" checked readOnly />
                        <Checkbox label="Disabled" checked={false} disabled readOnly />
                        <Checkbox label="Done, disabled" checked disabled readOnly />
                    </Row>
                    <Row label="In use">
                        <Checkbox
                            label="Count weekends too"
                            checked={agreed}
                            onChange={(event) => setAgreed(event.target.checked)}
                        />
                    </Row>
                </Section>

                <Section title="Choices">
                    <Row label="Switch">
                        <Switch
                            label="Evening reminder"
                            checked={reminders}
                            onChange={(event) => setReminders(event.target.checked)}
                        />
                        <Switch
                            label="Include weekends"
                            checked={weekends}
                            onChange={(event) => setWeekends(event.target.checked)}
                        />
                        <Switch label="Unavailable" checked={false} disabled readOnly />
                    </Row>
                    <Row label="One of a few">
                        <SegmentedControl
                            label="Range"
                            value={view}
                            onChange={setView}
                            options={[
                                { value: "week", label: "Week" },
                                { value: "month", label: "Month" },
                                { value: "year", label: "Year" },
                            ]}
                        />
                        <SegmentedControl
                            label="Range, unavailable"
                            value="week"
                            onChange={() => {}}
                            disabled
                            options={[
                                { value: "week", label: "Week" },
                                { value: "month", label: "Month" },
                            ]}
                        />
                    </Row>
                    <Row label="Keys">
                        <Kbd keys="mod+k" />
                        <Kbd>N</Kbd>
                        <Kbd>?</Kbd>
                        <Kbd>Esc</Kbd>
                        <Kbd keys="shift+enter" />
                        <Kbd keys="mod+backspace" />
                        <Kbd keys="arrowdown" />
                        <Kbd keys="g t" />
                    </Row>
                </Section>

                <Section title="Progress" note="Bars and numbers move from where they were. They never jump.">
                    <Row label="Bar">
                        <div className={styles.bars}>
                            <ProgressBar value={progress} max={8} label="Glasses of water" />
                            <ProgressBar size="md" value={progress} max={8} label="Glasses of water" />
                        </div>
                        <span className={styles.stepper}>
                            <IconButton
                                icon="minus"
                                label="One less"
                                variant="secondary"
                                size="sm"
                                onClick={() => setProgress((value) => Math.max(value - 1, 0))}
                            />
                            <IconButton
                                icon="plus"
                                label="One more"
                                variant="secondary"
                                size="sm"
                                onClick={() => setProgress((value) => Math.min(value + 1, 8))}
                            />
                        </span>
                        <span className={styles.count}>
                            <b>
                                <AnimatedNumber value={progress} />
                            </b>{" "}
                            of 8 glasses
                        </span>
                    </Row>
                    <Row label="Working">
                        <Loader label="Loading" />
                        <span className={styles.typeMeta}>The app’s sign for “working on it”.</span>
                    </Row>
                    <Row label="Loading">
                        <div className={styles.skeletons}>
                            <Skeleton variant="text" width="14ch" />
                            <Skeleton variant="text" width="26ch" />
                            <Skeleton height={6} width="100%" />
                        </div>
                    </Row>
                </Section>

                <OverlaysGallery />
                <ShellGallery />
                <DayGallery />
                <FirstRunGallery />
            </main>
        </div>
    );
};

export default GalleryPage;
