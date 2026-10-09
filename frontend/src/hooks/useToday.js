import { useContext } from "react";
import { TodayContext } from "../context/TodayContext";

const useToday = () => {
    const context = useContext(TodayContext);

    if (!context) {
        throw new Error("useToday must be used within a TodayProvider");
    }

    return context;
};

export default useToday;
