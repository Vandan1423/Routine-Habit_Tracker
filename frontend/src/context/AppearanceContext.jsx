import { createContext, useEffect, useMemo, useState } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import useMediaQuery from "../hooks/useMediaQuery";
import {
    applyMotion,
    applyTheme,
    DEFAULT_MOTION,
    DEFAULT_THEME,
    MOTION_STORAGE_KEY,
    MOTIONS,
    readStoredChoice,
    storeChoice,
    THEME_STORAGE_KEY,
    THEMES,
} from "../lib/appearance";
import { DEFAULT_TRANSITION } from "../lib/motion";

const AppearanceContext = createContext(null);

const INSTANT = { duration: 0 };

// Fetched once the app is on screen, so the animation code never delays the first paint
const loadMotionFeatures = () =>
    import("../lib/motionFeatures").then((features) => features.default);

export const AppearanceProvider = ({ children }) => {
    // "light", "dark" or "system"
    const [theme, setThemeChoice] = useState(() =>
        readStoredChoice(THEME_STORAGE_KEY, THEMES, DEFAULT_THEME),
    );
    // "system" or "reduce"
    const [motion, setMotionChoice] = useState(() =>
        readStoredChoice(MOTION_STORAGE_KEY, MOTIONS, DEFAULT_MOTION),
    );

    const systemIsDark = useMediaQuery("(prefers-color-scheme: dark)");
    const systemReducesMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

    const resolvedTheme = theme === "system" ? (systemIsDark ? "dark" : "light") : theme;
    const reducedMotion = motion === "reduce" || systemReducesMotion;

    useEffect(() => {
        applyTheme(resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        applyMotion(motion);
    }, [motion]);

    // A choice made in another tab applies here as well
    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key === THEME_STORAGE_KEY) {
                setThemeChoice(readStoredChoice(THEME_STORAGE_KEY, THEMES, DEFAULT_THEME));
            }
            if (event.key === MOTION_STORAGE_KEY) {
                setMotionChoice(readStoredChoice(MOTION_STORAGE_KEY, MOTIONS, DEFAULT_MOTION));
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    const value = useMemo(
        () => ({
            theme,
            resolvedTheme,
            setTheme: (next) => {
                if (!THEMES.includes(next)) return;
                storeChoice(THEME_STORAGE_KEY, next);
                setThemeChoice(next);
            },

            motion,
            reducedMotion,
            setMotion: (next) => {
                if (!MOTIONS.includes(next)) return;
                storeChoice(MOTION_STORAGE_KEY, next);
                setMotionChoice(next);
            },
        }),
        [theme, resolvedTheme, motion, reducedMotion],
    );

    return (
        <AppearanceContext.Provider value={value}>
            {/* With motion reduced, whatever the library animates lands at once, as the CSS rule in base.css does for the rest */}
            <MotionConfig
                reducedMotion={reducedMotion ? "always" : "never"}
                transition={reducedMotion ? INSTANT : DEFAULT_TRANSITION}
            >
                {/* Components animate with the light `m` elements from "motion/react-m", never the full `motion` ones */}
                <LazyMotion features={loadMotionFeatures} strict>
                    {children}
                </LazyMotion>
            </MotionConfig>
        </AppearanceContext.Provider>
    );
};

export { AppearanceContext };
