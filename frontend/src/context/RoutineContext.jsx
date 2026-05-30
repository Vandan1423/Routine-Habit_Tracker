import { createContext, useState, useEffect, useCallback } from "react";
import routineService from "../services/routineService";
import api from "../services/api";

const RoutineContext = createContext(null);

// Helper function to format Date object to local YYYY-MM-DD (avoids UTC timezone shift bugs)
const formatDateToLocal = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const RoutineProvider = ({ children }) => {
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Fetch routines for the currently selected date
    const fetchRoutines = useCallback(async (dateToFetch) => {
        try {
            setLoading(true);
            const dateString = formatDateToLocal(dateToFetch);

            // Note: Our backend returns { routines: [...] } based on our latest controller update
            const response = await routineService.getRoutines(dateString);
            setRoutines(response.routines || []);
        } catch (error) {
            console.error("Error fetching routines:", error);
            setRoutines([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect: Automatically fetch when selectedDate changes
    useEffect(() => {
        // Pushing the fetch to the next event loop tick prevents the synchronous double-render
        // and acts as a micro-debounce if the user clicks through dates quickly!
        const fetchTimer = setTimeout(() => {
            fetchRoutines(selectedDate);
        }, 0);

        // Cleanup function prevents memory leaks if the date changes rapidly
        return () => clearTimeout(fetchTimer);
    }, [selectedDate, fetchRoutines]);

    // Create
    const createRoutine = async (data) => {
        try {
            // Attach the currently selected date to the payload so one-time tasks know where to live!
            const payload = {
                ...data,
                date: formatDateToLocal(selectedDate),
            };

            const newRoutine = await routineService.createRoutine(payload);

            await fetchRoutines(selectedDate);
            return { success: true, data: newRoutine };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    // Update
    const updateRoutine = async (id, data) => {
        try {
            const updatedRoutine = await routineService.updateRoutine(id, data);

            // Instantly update the local UI without waiting for a refetch
            setRoutines((prev) =>
                prev.map((r) => (r._id === id ? updatedRoutine : r)),
            );
            return { success: true, data: updatedRoutine };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    // Delete (Soft Delete)
    const deleteRoutine = async (id) => {
        try {
            await routineService.deleteRoutine(id);

            // Instantly remove from local UI
            setRoutines((prev) => prev.filter((r) => r._id !== id));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const completeRoutine = async (id, date) => {
        try {
            const response = await api.post(`/routines/${id}/complete`, {
                date,
            });
            // Refresh local state by updating the routine with the new todayLog
            setRoutines((prev) =>
                prev.map((r) =>
                    r._id === id ? { ...r, todayLog: response.data.log } : r,
                ),
            );
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const uncompleteRoutine = async (id, date) => {
        try {
            await routineService.uncompleteRoutine(id, date);
            // Remove the todayLog from local state instantly
            setRoutines((prev) =>
                prev.map((r) => (r._id === id ? { ...r, todayLog: null } : r)),
            );
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    // Reorder (Bonus: Added this so your drag-and-drop is ready to go!)
    const reorderRoutines = async (reorderedRoutinesArray) => {
        try {
            // 1. Optimistically update UI instantly for a snappy drag-and-drop feel
            setRoutines(reorderedRoutinesArray);

            // 2. Map it to the { id, order } format our backend expects
            const payload = {
                routines: reorderedRoutinesArray.map((r, index) => ({
                    id: r._id,
                    order: index,
                })),
            };

            // 3. Send to backend in the background
            await routineService.reorderRoutines(payload);
            return { success: true };
        } catch (error) {
            // If it fails, fetch from the database to reset the UI to the truth
            await fetchRoutines(selectedDate);
            return { success: false, message: error.message };
        }
    };

    const value = {
        routines,
        loading,
        selectedDate,
        setSelectedDate,
        fetchRoutines,
        createRoutine,
        updateRoutine,
        deleteRoutine,
        reorderRoutines,
        completeRoutine,
        uncompleteRoutine,
    };

    return (
        <RoutineContext.Provider value={value}>
            {children}
        </RoutineContext.Provider>
    );
};

export { RoutineContext };
