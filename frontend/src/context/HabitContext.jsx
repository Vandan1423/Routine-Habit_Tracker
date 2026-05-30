import { createContext, useState, useEffect, useCallback } from "react";
import habitService from "../services/habitService";

const HabitContext = createContext(null);

export const HabitProvider = ({ children }) => {
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch all habits and today's logs
    const fetchHabits = useCallback(async () => {
        try {
            setLoading(true);
            const response = await habitService.getHabits();
            // Backend returns { habits: [...] }
            setHabits(response.habits || []);
        } catch (error) {
            console.error("Error fetching habits:", error);
            setHabits([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect: Fetch automatically on mount
    useEffect(() => {
        // Pushing the fetch to the next event loop tick prevents the synchronous double-render
        const fetchTimer = setTimeout(() => {
            fetchHabits();
        }, 0);

        // Cleanup function prevents memory leaks
        return () => clearTimeout(fetchTimer);
    }, [fetchHabits]);

    // Create
    const createHabit = async (data) => {
        try {
            const result = await habitService.createHabit(data);

            // Format the new habit perfectly for the UI (new habits have no logs yet)
            const newHabit = { ...result.habit, todayLog: null };

            // Instantly append to local UI
            setHabits((prev) => [...prev, newHabit]);
            return { success: true, data: newHabit };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    // Update
    const updateHabit = async (id, data) => {
        try {
            const result = await habitService.updateHabit(id, data);

            // Update the habit in the local UI, preserving its current todayLog
            setHabits((prev) =>
                prev.map((h) =>
                    h._id === id
                        ? { ...result.habit, todayLog: h.todayLog }
                        : h,
                ),
            );
            return { success: true, data: result.habit };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    // Delete (Soft Delete)
    const deleteHabit = async (id) => {
        try {
            await habitService.deleteHabit(id);

            // Instantly remove from local UI
            setHabits((prev) => prev.filter((h) => h._id !== id));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    // Log a Habit (Complete it)
    const logHabit = async (id, data = {}) => {
        try {
            const result = await habitService.logHabit(id, data);

            // Backend returns { habit, log }. We merge them together for the UI state.
            const updatedHabit = { ...result.habit, todayLog: result.log };

            setHabits((prev) =>
                prev.map((h) => (h._id === id ? updatedHabit : h)),
            );

            return { success: true, data: updatedHabit };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const value = {
        habits,
        loading,
        fetchHabits,
        createHabit,
        updateHabit,
        deleteHabit,
        logHabit,
    };

    return (
        <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
    );
};

export { HabitContext };
