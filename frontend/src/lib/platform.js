// True on Macs, iPhones and iPads, where shortcuts use ⌘ rather than Ctrl
export const isApplePlatform = () => {
    if (typeof navigator === "undefined") {
        return false;
    }

    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    return /mac|iphone|ipad|ipod/i.test(platform);
};

// Whether a form's first field should take the cursor as its page opens: yes where there is a keyboard to
// type with. On a touch screen that would raise the on-screen keyboard over half the page before it is read.
export const startsFocused =
    typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: fine)").matches);
