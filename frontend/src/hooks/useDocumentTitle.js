import { useEffect } from "react";
import { APP_NAME } from "../lib/app";

// Names the browser tab after the screen ("Today · Nitya") for as long as the caller is mounted.
// With no title it leaves the tab alone.
const useDocumentTitle = (title) => {
    useEffect(() => {
        if (!title) {
            return undefined;
        }

        document.title = `${title} · ${APP_NAME}`;
        return () => {
            document.title = APP_NAME;
        };
    }, [title]);
};

export default useDocumentTitle;
