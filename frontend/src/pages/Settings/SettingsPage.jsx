import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import DeleteAccountDialog from "./DeleteAccountDialog";
import PasswordDialog from "./PasswordDialog";
import { DayLayout } from "../../components/day";
import Page from "../../components/shell/Page";
import TrashDays from "../../components/trash/TrashDays";
import {
    Button,
    ConfirmDialog,
    Input,
    Kbd,
    SectionHeader,
    SegmentedControl,
    Select,
    Switch,
} from "../../components/ui";
import useAppearance from "../../hooks/useAppearance";
import useAuth from "../../hooks/useAuth";
import useCommands from "../../hooks/useCommands";
import { THEME_OPTIONS } from "../../lib/appearance";
import { cx } from "../../lib/cx";
import { TRASH_PATH } from "../../lib/places";
import {
    needsHomeScreen,
    permission,
    remindersOnHere,
    sendTestReminder,
    subscribeReminders,
    turnOffHere,
    turnOnHere,
} from "../../lib/notify";
import { DEFAULT_REMINDER_LEAD, END_REMINDER_OPTIONS, REMINDER_LEAD_OPTIONS } from "../../lib/reminders";
import { KEYS } from "../../lib/shortcuts";
import { timezoneWords } from "../../lib/timezone";
import { TRASH_DAYS_NOTE } from "../../lib/trashWords";
import { toast } from "../../lib/toast";
import styles from "./SettingsPage.module.css";

// What the server takes for a name (registerSchema)
const NAME_SHORTEST = 2;
const NAME_LONGEST = 50;

// A group of settings under a small heading
const Section = ({ title, className, children }) => {
    const id = useId();

    return (
        <section className={cx(styles.section, className)} aria-labelledby={id}>
            <SectionHeader title={<span id={id}>{title}</span>} />
            {children}
        </section>
    );
};

/**
 * One setting: what it is and a line about it on the left, the control on the right.
 * stack: on a phone the control goes under the words instead of beside them (for anything wider than a switch)
 */
const Row = ({ name, note, stack = false, children }) => (
    <div className={cx(styles.row, stack && styles.stack)}>
        <div className={styles.what}>
            <p className={styles.name}>{name}</p>
            {note && <p className={styles.note}>{note}</p>}
        </div>
        <div className={styles.control}>{children}</div>
    </div>
);

// The name the account goes by, changed in place
const NameRow = () => {
    const { user, updateProfile } = useAuth();
    const saved = user?.name ?? "";

    const [text, setText] = useState(saved);
    const [textIsFor, setTextIsFor] = useState(saved);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    // The name changed elsewhere (another tab, or the save just made): show it
    if (textIsFor !== saved) {
        setTextIsFor(saved);
        setText(saved);
    }

    const name = text.trim();
    const changed = name !== saved.trim();

    const submit = async (event) => {
        event.preventDefault();
        if (!changed || saving) return;

        if (name.length < NAME_SHORTEST || name.length > NAME_LONGEST) {
            setError(`Use between ${NAME_SHORTEST} and ${NAME_LONGEST} characters.`);
            return;
        }

        setSaving(true);
        try {
            await updateProfile({ name });
            toast("Name changed");
        } catch (failure) {
            setError(failure.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Row name="Name" note="How the app addresses you." stack>
            <form className={styles.inline} onSubmit={submit} noValidate>
                <Input
                    className={styles.nameField}
                    aria-label="Name"
                    autoComplete="name"
                    maxLength={NAME_LONGEST}
                    value={text}
                    error={error}
                    onChange={(event) => {
                        setText(event.target.value);
                        setError("");
                    }}
                />
                <Button type="submit" disabled={!changed} loading={saving}>
                    Save
                </Button>
            </form>
        </Row>
    );
};

// What is said under "On this device", by where reminders stand here
const deviceNote = (on, state) => {
    if (state === "unsupported") {
        return needsHomeScreen()
            ? "On iPhone and iPad, add the app to your Home Screen first (Share, then Add to Home Screen) and turn reminders on from there."
            : "This browser can’t show notifications.";
    }
    if (state === "denied") {
        return "Notifications are blocked for this site. Allow them in the browser’s site settings, then turn this on.";
    }
    return on
        ? "Reminders come to this device before each routine, and for habits still open."
        : "Get a reminder before each routine and one-off task, and a nudge for habits still open.";
};

/**
 * Reminders: whether this device gets them (its own choice, with the browser's permission), and how early
 * they come and whether habits are nudged about (the account's, the same on every device).
 */
const ReminderRows = () => {
    const { user, updateProfile } = useAuth();
    const on = useSyncExternalStore(subscribeReminders, remindersOnHere, () => false);
    const [state, setState] = useState(permission);
    const [busy, setBusy] = useState(false);
    // What was just chosen, until the account itself says the same
    const [chosen, setChosen] = useState({});

    const lead = chosen.reminderLead ?? user?.reminderLead ?? DEFAULT_REMINDER_LEAD;
    const habitsOn = chosen.remindHabits ?? user?.remindHabits ?? true;
    const moneyOn = chosen.remindMoney ?? user?.remindMoney ?? true;
    // null on the account is "off" in the list
    const endLead =
        "endReminderLead" in chosen ? chosen.endReminderLead : (user?.endReminderLead ?? null);

    const toggle = async (wanted) => {
        setBusy(true);
        try {
            if (!wanted) {
                await turnOffHere();
                return;
            }

            const result = await turnOnHere();
            setState(permission());
            if (result.on) {
                toast("Reminders are on for this device", {
                    detail: result.push ? undefined : "They come while the app is open in a tab.",
                });
            } else if (result.reason === "denied") {
                toast.error("Notifications are blocked for this site.");
            }
        } catch {
            toast.error("Reminders couldn’t be turned on. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const save = async (field, value) => {
        setChosen((current) => ({ ...current, [field]: value }));
        try {
            await updateProfile({ [field]: value });
        } catch {
            toast.error("That didn’t save. Check your connection and try again.");
        } finally {
            setChosen((current) => {
                const next = { ...current };
                delete next[field];
                return next;
            });
        }
    };

    const test = async () => {
        try {
            await sendTestReminder();
        } catch {
            toast.error("The test reminder couldn’t be shown.");
        }
    };

    return (
        <>
            <Row name="On this device" note={deviceNote(on, state)}>
                <Switch
                    aria-label="Reminders on this device"
                    checked={on}
                    disabled={busy || state === "unsupported"}
                    onChange={(event) => toggle(event.target.checked)}
                />
            </Row>
            <Row name="Before a routine" note="How early the reminder comes. The same on all your devices." stack>
                <Select
                    aria-label="Before a routine"
                    options={REMINDER_LEAD_OPTIONS}
                    value={lead}
                    onChange={(value) => save("reminderLead", value)}
                />
            </Row>
            <Row
                name="Before a routine ends"
                note="Another reminder if it isn’t ticked off yet, before its end time passes."
                stack
            >
                <Select
                    aria-label="Before a routine ends"
                    options={END_REMINDER_OPTIONS}
                    value={endLead ?? "off"}
                    onChange={(value) => save("endReminderLead", value === "off" ? null : value)}
                />
            </Row>
            <Row
                name="Habits still open"
                note="A nudge in the morning, afternoon and evening for the habits of that part of the day not yet done, and one at 8 pm for the rest."
            >
                <Switch
                    aria-label="Habits still open"
                    checked={habitsOn}
                    onChange={(event) => save("remindHabits", event.target.checked)}
                />
            </Row>
            <Row
                name="Money due"
                note="Before a subscription is due (as many days ahead as each one asks), on its day, and if it is overdue; and when a spending limit nears or passes its line. In the daytime only."
            >
                <Switch
                    aria-label="Money due"
                    checked={moneyOn}
                    onChange={(event) => save("remindMoney", event.target.checked)}
                />
            </Row>
            <Row name="Try it" note="Sends a reminder now, to see how it looks here." stack>
                <Button icon="bell" disabled={!on} onClick={test}>
                    Send a test reminder
                </Button>
            </Row>
        </>
    );
};

/**
 * Settings: how the app looks and moves on this device, who the account belongs to, the zone its day
 * is counted in, and the ways out of it (signing out, here or everywhere, and deleting it).
 * Appearance is kept by this browser; everything else is the account's and is changed on the server.
 */
const SettingsPage = () => {
    const { user, logout, logoutAll, authLoading, refreshUser } = useAuth();
    const { theme, setTheme, motion, reducedMotion, setMotion } = useAppearance();
    const { openShortcuts } = useCommands();

    const [changingPassword, setChangingPassword] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [leavingAll, setLeavingAll] = useState(false);

    // The copy of the account this browser holds can be days old. Its zone, for one, may have moved since.
    useEffect(() => {
        refreshUser().catch(() => {
            // The cached copy stays on screen; nothing here depends on the fresh one
        });
    }, [refreshUser]);

    const zone = timezoneWords(user);
    // The device itself asks for less motion: the app already keeps still, whatever this switch says
    const deviceReduces = reducedMotion && motion !== "reduce";

    return (
        <Page>
            <DayLayout>
                <header className={styles.header}>
                    <div className={styles.text}>
                        <p className={styles.eyebrow}>{user?.email ?? " "}</p>
                        <h1 className={styles.title}>Settings</h1>
                    </div>
                </header>

                <Section title="Appearance">
                    <Row name="Theme" note="Kept on this device." stack>
                        <SegmentedControl
                            label="Theme"
                            options={THEME_OPTIONS}
                            value={theme}
                            onChange={setTheme}
                        />
                    </Row>
                    <Row
                        name="Reduce motion"
                        note={
                            deviceReduces
                                ? "This device already asks for less motion, so the app keeps still."
                                : "Changes land at once instead of moving into place."
                        }
                    >
                        <Switch
                            aria-label="Reduce motion"
                            checked={reducedMotion}
                            disabled={deviceReduces}
                            onChange={(event) => setMotion(event.target.checked ? "reduce" : "system")}
                        />
                    </Row>
                </Section>

                <Section title="Profile">
                    <NameRow />
                    <Row name="Email" note="You sign in with this address. It can’t be changed here." stack>
                        <span className={styles.value}>{user?.email}</span>
                    </Row>
                </Section>

                <Section title="Reminders">
                    <ReminderRows />
                </Section>

                <Section title="Your day">
                    <Row name="Time zone" note={zone.note} stack>
                        <span className={styles.value}>
                            {zone.zone}
                            {zone.offset && <span className={styles.aside}>{zone.offset}</span>}
                        </span>
                    </Row>
                </Section>

                <Section title="Trash">
                    <Row name="Keep deleted things for" note={TRASH_DAYS_NOTE} stack>
                        <TrashDays />
                    </Row>
                    <Row name="What is in it" note="Everything you have deleted, until its time runs out." stack>
                        <Button as={Link} to={TRASH_PATH}>
                            Open Trash
                        </Button>
                    </Row>
                </Section>

                {/* Left out on a device with no keys to press (see Kbd) */}
                <Section title="Keyboard" className={styles.keyboard}>
                    <Row
                        name="Shortcuts"
                        note={
                            <>
                                Most of the app works without a mouse. <Kbd keys={KEYS.menu} /> opens
                                the command menu from any screen.
                            </>
                        }
                        stack
                    >
                        <Button trailing={<Kbd keys={KEYS.help} />} onClick={openShortcuts}>
                            Show shortcuts
                        </Button>
                    </Row>
                </Section>

                <Section title="Account">
                    <Row name="Password" note="Changing it signs out your other devices." stack>
                        <Button onClick={() => setChangingPassword(true)}>Change password</Button>
                    </Row>
                    <Row name="Sign out" note="Of this device only." stack>
                        <Button icon="sign-out" loading={authLoading && !leavingAll} onClick={() => logout()}>
                            Sign out
                        </Button>
                    </Row>
                    <Row
                        name="Sign out everywhere"
                        note="Ends every session on every device, this one included."
                        stack
                    >
                        <Button onClick={() => setLeavingAll(true)}>Sign out everywhere</Button>
                    </Row>
                    <Row
                        name="Delete account"
                        note="Erases your routines, habits, to-dos, goals, history and expenses for good. This does not go to Trash."
                        stack
                    >
                        <Button variant="danger" onClick={() => setDeleting(true)}>
                            Delete account
                        </Button>
                    </Row>
                </Section>

                <p className={styles.foot}>
                    <Link to="/privacy">What the app keeps about you, and why</Link>
                </p>
            </DayLayout>

            <PasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
            <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
            <ConfirmDialog
                open={leavingAll}
                onOpenChange={setLeavingAll}
                title="Sign out everywhere?"
                description="Every device signed in to this account is signed out, this one included. You sign in again with your password."
                confirmLabel="Sign out everywhere"
                onConfirm={() => logoutAll()}
            />
        </Page>
    );
};

export default SettingsPage;
