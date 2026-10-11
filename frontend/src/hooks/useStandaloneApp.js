import useMediaQuery from "./useMediaQuery";

// Whether the app was opened from a phone's or tablet's Home Screen, on its own with no browser around it:
// then there is no reload button and no pull-down to reload, so the app offers its own (components/shell)
const useStandaloneApp = () => {
    const displayMode = useMediaQuery("(display-mode: standalone)");
    return displayMode || (typeof navigator !== "undefined" && navigator.standalone === true);
};

// Loads the app again from the server
export const reloadApp = () => window.location.reload();

export default useStandaloneApp;
