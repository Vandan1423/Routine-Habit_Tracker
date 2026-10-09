import { useState } from "react";
import {
    Button,
    Calendar,
    ConfirmDialog,
    DatePicker,
    Dialog,
    EmptyState,
    ErrorState,
    IconButton,
    Input,
    Menu,
    Popover,
    SectionHeader,
    Select,
    SuggestInput,
    Switch,
    TimePicker,
    Tooltip,
    WeekdayPicker,
} from "../../components/ui";
import { addDays, localDay, monthOf } from "../../lib/dates";
import { toast } from "../../lib/toast";
import { formatTime } from "../../lib/time";
import { Row, Section } from "./GalleryParts";
import styles from "./GalleryPage.module.css";

// The second half of the gallery: everything that opens over the page or reports back to the reader.

const PLACES = ["Cafe Mocha", "Fresh Basket", "Office canteen", "Sunday market"];

const CATEGORIES = [
    { value: "health", label: "Health" },
    { value: "work", label: "Work" },
    { value: "personal", label: "Personal" },
    { value: "learning", label: "Learning" },
    { value: "fitness", label: "Fitness" },
    { value: "other", label: "Other" },
];

const SORTS = [
    { value: "time", label: "By time" },
    { value: "name", label: "By name" },
    { value: "streak", label: "By streak" },
];

const WEEKDAYS = [1, 2, 3, 4, 5];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// A small form, as Plan will use it: on a wide screen a panel, on a phone a sheet
const NewRoutineDialog = ({ presentation, trigger }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("personal");
    const [start, setStart] = useState("07:00");
    const [end, setEnd] = useState("");
    const [days, setDays] = useState(WEEKDAYS);
    const [tried, setTried] = useState(false);

    const nameError = tried && !name.trim() ? "Give it a name." : undefined;
    const daysError = tried && days.length === 0 ? "Choose at least one day." : undefined;

    const save = (event) => {
        event.preventDefault();
        setTried(true);
        if (!name.trim() || days.length === 0) return;

        setOpen(false);
        toast(`${name.trim()} added`, { detail: `${formatTime(start)}, ${days.length} days a week` });
        setName("");
        setTried(false);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            presentation={presentation}
            title="New routine"
            description="A timed task. Finishing it on time earns 10 XP; missing it costs 5."
            footer={
                <>
                    <Dialog.Close render={<Button>Cancel</Button>} />
                    <Button variant="primary" type="submit" form="gallery-new-routine">
                        Add routine
                    </Button>
                </>
            }
        >
            <form id="gallery-new-routine" className={styles.form} onSubmit={save} noValidate>
                <Input
                    label="Name"
                    placeholder="Morning walk"
                    value={name}
                    error={nameError}
                    onChange={(event) => setName(event.target.value)}
                />
                <div className={styles.formPair}>
                    <TimePicker label="Starts" value={start} onChange={setStart} />
                    <TimePicker label="Ends" hint="Optional." value={end} onChange={setEnd} />
                </div>
                <WeekdayPicker label="Repeats on" value={days} error={daysError} onChange={setDays} />
                <Select
                    label="Category"
                    options={CATEGORIES}
                    value={category}
                    onChange={setCategory}
                />
            </form>
        </Dialog>
    );
};

const OverlaysGallery = () => {
    const [sort, setSort] = useState("time");
    const [showDone, setShowDone] = useState(true);
    const [category, setCategory] = useState(null);
    const [start, setStart] = useState("07:30");
    const [end, setEnd] = useState("");
    const [days, setDays] = useState(WEEKDAYS);
    const [reminders, setReminders] = useState(true);
    const [place, setPlace] = useState("");
    const [today] = useState(localDay);
    const [day, setDay] = useState(today);
    const [month, setMonth] = useState(() => monthOf(today));

    const completeSomething = () =>
        toast("Deep work done", {
            detail: "+20 XP",
            action: { label: "Undo", onClick: () => toast("Deep work is open again") },
        });

    const failToSave = () =>
        toast.error("That didn’t save. Check your connection.", {
            action: { label: "Try again", onClick: completeSomething },
        });

    return (
        <>
            <Section
                title="Dialogs"
                note="The page behind is dimmed, never blurred. Esc closes, and focus goes back to the button that opened it."
            >
                <Row label="A form">
                    <NewRoutineDialog trigger={<Button icon="plus">New routine</Button>} />
                    <NewRoutineDialog
                        presentation="sheet"
                        trigger={<Button variant="ghost">The same, as a sheet</Button>}
                    />
                </Row>
                <Row label="A question">
                    <ConfirmDialog
                        trigger={<Button variant="danger">Delete habit</Button>}
                        title="Delete “Read”?"
                        description="Its history and its 12-day streak go with it. The XP it has earned stays."
                        confirmLabel="Delete habit"
                        tone="danger"
                        onConfirm={async () => {
                            await wait(900);
                            toast("Read deleted");
                        }}
                    />
                    <ConfirmDialog
                        trigger={<Button>Sign out everywhere</Button>}
                        title="Sign out of every device?"
                        description="You’ll need to sign in again on each one, including this one."
                        confirmLabel="Sign out everywhere"
                    />
                </Row>
                <Row label="A long one">
                    <Dialog
                        size="lg"
                        trigger={<Button>How XP works</Button>}
                        title="How XP works"
                        description="What each thing is worth, and what a miss costs."
                        footer={<Dialog.Close render={<Button variant="primary">Done</Button>} />}
                    >
                        <div className={styles.prose}>
                            {Array.from({ length: 9 }, (_, index) => (
                                <p key={index}>
                                    A routine finished on time earns 20 XP. Finished late, it earns 10.
                                    Left undone, it costs 10 when the day closes, and the day does not
                                    count towards the streak. Habits are worth 10, 15 or 25 XP by how hard
                                    you said they are.
                                </p>
                            ))}
                        </div>
                    </Dialog>
                </Row>
            </Section>

            <Section
                title="Menus"
                note="Arrow keys move, typing a letter jumps, Enter chooses. Everything that floats shares one surface."
            >
                <Row label="Actions">
                    <Menu trigger={<IconButton icon="more" label="More" />}>
                        <Menu.Item icon="edit" shortcut="e" onSelect={() => toast("Editing Read")}>
                            Edit
                        </Menu.Item>
                        <Menu.Item icon="repeat" onSelect={() => toast("Read now repeats daily")}>
                            Change days
                        </Menu.Item>
                        <Menu.Item icon="clock" disabled>
                            Move to tomorrow
                        </Menu.Item>
                        <Menu.Separator />
                        <Menu.Item icon="trash" tone="danger" onSelect={() => toast("Read deleted")}>
                            Delete
                        </Menu.Item>
                    </Menu>
                    <Menu
                        align="end"
                        trigger={
                            <Button variant="ghost" icon="settings">
                                View
                            </Button>
                        }
                    >
                        <Menu.RadioGroup label="Order" value={sort} onChange={setSort}>
                            {SORTS.map((option) => (
                                <Menu.RadioItem key={option.value} value={option.value}>
                                    {option.label}
                                </Menu.RadioItem>
                            ))}
                        </Menu.RadioGroup>
                        <Menu.Separator />
                        <Menu.CheckboxItem checked={showDone} onChange={setShowDone}>
                            Show what’s done
                        </Menu.CheckboxItem>
                    </Menu>
                </Row>
                <Row label="Select">
                    <div className={styles.pairs}>
                        <Select
                            label="Category"
                            placeholder="Choose a category"
                            options={CATEGORIES}
                            value={category}
                            onChange={setCategory}
                        />
                        <Select
                            label="Order"
                            hint="Applies to Plan."
                            options={SORTS}
                            value={sort}
                            onChange={setSort}
                        />
                        <Select
                            label="Category"
                            placeholder="Choose a category"
                            options={CATEGORIES}
                            value={null}
                            error="Choose one."
                        />
                        <Select label="Timezone" options={CATEGORIES} defaultValue="other" disabled />
                    </div>
                </Row>
                <Row label="Popover">
                    <Popover
                        trigger={<Button icon="info">What a miss costs</Button>}
                        title="Stakes"
                        description="A routine left undone costs 10 XP when the day closes. A habit costs 5."
                    >
                        <Switch
                            label="Remind me in the evening"
                            checked={reminders}
                            onChange={(event) => setReminders(event.target.checked)}
                        />
                    </Popover>
                </Row>
                <Row label="Tooltip">
                    <Tooltip label="Edit" shortcut="e">
                        <IconButton icon="edit" label="Edit" />
                    </Tooltip>
                    <Tooltip label="Delete">
                        <IconButton icon="trash" label="Delete" />
                    </Tooltip>
                    <Tooltip label="Search" shortcut="mod+k" side="bottom">
                        <IconButton icon="search" label="Search" variant="secondary" />
                    </Tooltip>
                </Row>
            </Section>

            <Section
                title="Time and days"
                note="Type a time the way you would say it, or pick it. Nothing here is drawn by the browser."
            >
                <Row label="Time">
                    <div className={styles.pairs}>
                        <TimePicker
                            label="Starts"
                            hint="Try 7, 730 or 7:30 pm."
                            value={start}
                            onChange={setStart}
                        />
                        <TimePicker label="Ends" hint="Optional." value={end} onChange={setEnd} />
                        <TimePicker label="Ends" value="06:00" error="This is before the start." />
                        <TimePicker label="Starts" value="09:00" disabled />
                    </div>
                </Row>
                <Row label="Typed before">
                    <div className={styles.pairs}>
                        <SuggestInput
                            label="Place"
                            hint="Offers what was typed before. Try “ca”."
                            placeholder="Optional"
                            suggestions={PLACES}
                            value={place}
                            onChange={setPlace}
                        />
                    </div>
                </Row>
                <Row label="Days">
                    <div className={styles.stack}>
                        <WeekdayPicker label="Repeats on" value={days} onChange={setDays} />
                        <WeekdayPicker
                            label="Repeats on"
                            value={[]}
                            error="Choose at least one day."
                            onChange={() => {}}
                        />
                        <WeekdayPicker aria-label="Repeats on, unavailable" value={[0, 6]} disabled />
                    </div>
                </Row>
                <Row label="A day">
                    <div className={styles.pairs}>
                        <DatePicker
                            label="Day"
                            hint="Today or later. Arrows move, Page Up and Down turn the month."
                            value={day}
                            today={today}
                            min={today}
                            onChange={setDay}
                        />
                        <DatePicker label="Day" value="" today={today} error="Choose a day." />
                    </div>
                </Row>
                <Row label="A month, for reading">
                    <div className={styles.stack}>
                        <Calendar
                            label="Example month"
                            month={month}
                            onMonthChange={setMonth}
                            today={today}
                            min={addDays(today, -60)}
                            max={today}
                            describeDay={(date) => (date < today && date.endsWith("3") ? "Marked" : "")}
                            renderDay={(date) =>
                                date < today && date.endsWith("3") ? <b aria-hidden="true">·</b> : null
                            }
                        />
                    </div>
                </Row>
            </Section>

            <Section
                title="Feedback"
                note="A toast is quiet text with at most one action. An error says what happened and what to do next."
            >
                <Row label="Toast">
                    <Button onClick={completeSomething}>Complete something</Button>
                    <Button onClick={() => toast("Theme set to dark")}>Plain</Button>
                    <Button onClick={failToSave}>Something fails</Button>
                    <Button
                        onClick={() =>
                            toast(
                                "Evening review and planning for tomorrow moved to 9:30 pm, after Read",
                                { action: { label: "Undo", onClick: () => {} } },
                            )
                        }
                    >
                        A long one
                    </Button>
                </Row>
                <Row label="Heading">
                    <div className={styles.stack}>
                        <SectionHeader title="Morning" meta="3 of 4" current as="h3" />
                        <SectionHeader
                            title="Afternoon"
                            meta="0 of 2"
                            as="h3"
                            actions={
                                <Button variant="ghost" size="sm" icon="plus">
                                    Add
                                </Button>
                            }
                        />
                    </div>
                </Row>
                <Row label="Empty">
                    <EmptyState
                        as="h3"
                        title="Your day starts here"
                        actions={
                            <>
                                <Button variant="primary">Add a routine</Button>
                                <Button>Add a habit</Button>
                            </>
                        }
                    >
                        Add the first thing you want to do today. The rest of the routine can grow one
                        step at a time.
                    </EmptyState>
                </Row>
                <Row label="Empty, small">
                    <EmptyState
                        as="h3"
                        size="sm"
                        segments={3}
                        title="Nothing this evening"
                        actions={
                            <Button size="sm" icon="plus">
                                Add something
                            </Button>
                        }
                    >
                        The evening is free. Add a wind-down if you want one.
                    </EmptyState>
                </Row>
                <Row label="Error">
                    <ErrorState as="h3" title="Today didn’t load" onRetry={() => wait(1200)} />
                </Row>
                <Row label="Error, small">
                    <ErrorState as="h3" size="sm" title="The week didn’t load" onRetry={() => wait(1200)}>
                        Your items above are up to date.
                    </ErrorState>
                </Row>
            </Section>
        </>
    );
};

export default OverlaysGallery;
