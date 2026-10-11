// The app's own icon set. Every icon is drawn on a 20 px grid with a 1.5 stroke, round ends and no fill
// (the stroke and colour come from Icon.module.css), so they read as one family at any size.
// To add one, draw it the same way and give it a name here.
export const ICONS = {
    // Navigation
    today: <path d="M2.5 14.5h15M5.5 14.5a4.5 4.5 0 0 1 9 0M10 5v2M4.3 8.3l1.4 1.4M15.7 8.3l-1.4 1.4" />,
    plan: (
        <>
            <path d="M8.5 5.5h8M8.5 10h8M8.5 14.5h8" />
            <rect x="3.5" y="4" width="3" height="3" rx=".8" />
            <rect x="3.5" y="8.5" width="3" height="3" rx=".8" />
            <rect x="3.5" y="13" width="3" height="3" rx=".8" />
        </>
    ),
    insights: <path d="M4.5 16V10M10 16V4.5M15.5 16v-4" />,
    history: (
        <>
            <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
            <path d="M3 8.5h14M7 2.8v3M13 2.8v3" />
        </>
    ),
    calendar: (
        <>
            <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
            <path d="M3 8.5h14M7 2.8v3M13 2.8v3M7 12.5h2" />
        </>
    ),
    expenses: (
        <>
            <path d="M5 3h10v14l-2.5-1.6L10 17l-2.5-1.6L5 17z" />
            <path d="M8 7.2h4M8 10.4h4" />
        </>
    ),
    settings: (
        <>
            <path d="M3 6h7M15.5 6H17M3 14h1.5M10 14h7" />
            <circle cx="12.8" cy="6" r="2.2" />
            <circle cx="7.2" cy="14" r="2.2" />
        </>
    ),
    todo: (
        <>
            <circle cx="10" cy="10" r="7" />
            <path d="M6.8 10.3l2.2 2.2 4.2-4.7" />
        </>
    ),
    goal: <path d="M5 17V3.5M5 4.5h10l-2.2 3 2.2 3H5" />,
    sidebar: (
        <>
            <rect x="3" y="4" width="14" height="12" rx="2.5" />
            <path d="M8 4v12" />
        </>
    ),
    user: (
        <>
            <circle cx="10" cy="6.8" r="3" />
            <path d="M3.8 16.5c.9-2.8 3.2-4.3 6.2-4.3s5.3 1.5 6.2 4.3" />
        </>
    ),
    "sign-out": (
        <>
            <path d="M8 3.5H5.5A1.5 1.5 0 0 0 4 5v10a1.5 1.5 0 0 0 1.5 1.5H8" />
            <path d="M12.5 6.5L16 10l-3.5 3.5M16 10H8" />
        </>
    ),

    // Actions
    search: (
        <>
            <circle cx="9" cy="9" r="5" />
            <path d="M13 13l3.5 3.5" />
        </>
    ),
    plus: <path d="M10 4.5v11M4.5 10h11" />,
    minus: <path d="M4.5 10h11" />,
    check: <path d="M4.5 10.5l3.5 3.5 7.5-8" />,
    chevron: <path d="M5.5 8l4.5 4.5L14.5 8" />,
    close: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
    edit: <path d="M12.5 4.5l3 3L7 16H4v-3zM10.8 6.2l3 3" />,
    trash: (
        <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.7 9.5a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L14.5 6M8.5 9v5M11.5 9v5" />
    ),
    undo: <path d="M7.5 4.5L4 8l3.5 3.5M4 8h8a4 4 0 0 1 0 8H9" />,
    // A box with its lid: put away, not thrown out
    archive: (
        <>
            <rect x="3" y="4" width="14" height="3.5" rx="1" />
            <path d="M4.5 7.5V15a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7.5M8 10.5h4" />
        </>
    ),
    pause: <path d="M7.5 5v10M12.5 5v10" />,
    refresh: <path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9M15.5 3.8v3.4h-3.4" />,
    play: <path d="M6.5 4.5v11l9-5.5z" />,
    bell: (
        <>
            <path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z" />
            <path d="M8.3 17a1.8 1.8 0 0 0 3.4 0" />
        </>
    ),
    more: (
        <>
            <circle cx="4.5" cy="10" r=".6" />
            <circle cx="10" cy="10" r=".6" />
            <circle cx="15.5" cy="10" r=".6" />
        </>
    ),
    grip: (
        <>
            <circle cx="7.5" cy="5.5" r=".6" />
            <circle cx="12.5" cy="5.5" r=".6" />
            <circle cx="7.5" cy="10" r=".6" />
            <circle cx="12.5" cy="10" r=".6" />
            <circle cx="7.5" cy="14.5" r=".6" />
            <circle cx="12.5" cy="14.5" r=".6" />
        </>
    ),
    external: (
        <path d="M11.5 4H16v4.5M16 4l-6.5 6.5M8.5 5.5h-3A1.5 1.5 0 0 0 4 7v7.5A1.5 1.5 0 0 0 5.5 16H13a1.5 1.5 0 0 0 1.5-1.5v-3" />
    ),

    // Direction
    "chevron-down": <path d="M5.5 8l4.5 4.5L14.5 8" />,
    "chevron-up": <path d="M5.5 12L10 7.5l4.5 4.5" />,
    "chevron-right": <path d="M8 5.5l4.5 4.5L8 14.5" />,
    "chevron-left": <path d="M12 5.5L7.5 10l4.5 4.5" />,
    "arrow-right": <path d="M4 10h12M11.5 5.5L16 10l-4.5 4.5" />,
    "arrow-left": <path d="M16 10H4M8.5 5.5L4 10l4.5 4.5" />,

    // Time
    clock: (
        <>
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6.2V10l2.5 1.9" />
        </>
    ),
    repeat: (
        <path d="M4 9.2V8a2.5 2.5 0 0 1 2.5-2.5H16M13.5 3L16 5.5 13.5 8M16 10.8V12a2.5 2.5 0 0 1-2.5 2.5H4M6.5 12L4 14.5 6.5 17" />
    ),

    // Appearance
    sun: (
        <>
            <circle cx="10" cy="10" r="3.1" />
            <path d="M10 2.6v1.6M10 15.8v1.6M2.6 10h1.6M15.8 10h1.6M4.8 4.8l1.1 1.1M14.1 14.1l1.1 1.1M15.2 4.8l-1.1 1.1M5.9 14.1l-1.1 1.1" />
        </>
    ),
    moon: <path d="M16.5 11.2A6.5 6.5 0 1 1 8.8 3.5a6 6 0 0 0 7.7 7.7z" />,
    monitor: (
        <>
            <rect x="2.8" y="3.8" width="14.4" height="9.8" rx="1.8" />
            <path d="M7 16.5h6M10 13.6v2.9" />
        </>
    ),

    motion: (
        <>
            <circle cx="13.2" cy="10" r="3.8" />
            <path d="M2.5 6.8h4.5M2.5 10h3M2.5 13.2h4.5" />
        </>
    ),
    keyboard: (
        <>
            <rect x="2.5" y="5" width="15" height="10" rx="2" />
            <path d="M5.8 8.3v.01M8.6 8.3v.01M11.4 8.3v.01M14.2 8.3v.01M7 11.7h6" />
        </>
    ),

    // Status
    info: (
        <>
            <circle cx="10" cy="10" r="7" />
            <path d="M10 9.3v4.2M10 6.6v.01" />
        </>
    ),
    alert: <path d="M10 3.6L17.2 16H2.8zM10 8.6V12M10 14v.01" />,
    eye: (
        <>
            <path d="M2.5 10c1.8-3.4 4.4-5.2 7.5-5.2s5.7 1.8 7.5 5.2c-1.8 3.4-4.4 5.2-7.5 5.2S4.3 13.4 2.5 10z" />
            <circle cx="10" cy="10" r="2.3" />
        </>
    ),
    "eye-off": (
        <path d="M3.5 3.5l13 13M8.2 5c.6-.13 1.2-.2 1.8-.2 3.1 0 5.7 1.8 7.5 5.2-.6 1.1-1.3 2.1-2 2.8M12.4 14.8c-.8.27-1.6.4-2.4.4-3.1 0-5.7-1.8-7.5-5.2.9-1.7 2-3 3.3-3.9M8.3 8.4a2.3 2.3 0 0 0 3.2 3.3" />
    ),
};
