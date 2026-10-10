// The reader's own choices about how the app looks: theme and motion.
// index.html applies the saved ones before the first paint; keep the keys and defaults there in step with these.

export const THEME_STORAGE_KEY = "nityakram.theme";
export const MOTION_STORAGE_KEY = "nityakram.motion";

export const THEMES = ["light", "dark", "system"];
export const DEFAULT_THEME = "light";

// The themes as a control shows them
export const THEME_OPTIONS = [
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Dark", icon: "moon" },
    { value: "system", label: "System", icon: "monitor" },
];

export const MOTIONS = ["system", "reduce"];
export const DEFAULT_MOTION = "system";

export const readStoredChoice = (key, allowed, fallback) => {
    try {
        const stored = window.localStorage.getItem(key);
        return allowed.includes(stored) ? stored : fallback;
    } catch {
        return fallback; // storage can be blocked; the choice then lasts for this visit only
    }
};

export const storeChoice = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // see readStoredChoice
    }
};

// Puts a theme ("light" or "dark") on the page
export const applyTheme = (theme) => {
    const root = document.documentElement;

    if (root.dataset.theme !== theme) {
        // Colours swap in one frame; base.css turns transitions off while this attribute is present
        root.dataset.themeSwitching = "";
        root.dataset.theme = theme;
        requestAnimationFrame(() =>
            requestAnimationFrame(() => delete root.dataset.themeSwitching),
        );
    }

    // The browser's own chrome (the phone status bar, the tab strip) takes the paper colour
    const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
    if (paper) {
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", paper);
    }
};

export const applyMotion = (motion) => {
    const root = document.documentElement;

    if (motion === "reduce") {
        root.dataset.motion = "reduce";
    } else {
        delete root.dataset.motion;
    }
};
