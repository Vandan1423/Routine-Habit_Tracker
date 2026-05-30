import { useContext } from "react";
import { HabitContext } from "../context/HabitContext";

const useHabit = () => {
    const context = useContext(HabitContext);

    if (!context) {
        throw new Error("useHabit must be used within a HabitProvider");
    }

    return context;
};

export default useHabit;
