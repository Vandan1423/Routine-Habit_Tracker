import { useEffect, useState } from "react";

// Whole seconds since the caller mounted, counted up once a second
const useElapsedSeconds = () => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return elapsed;
};

export default useElapsedSeconds;
