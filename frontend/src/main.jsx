import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { RoutineProvider } from "./context/RoutineContext";
import { HabitProvider } from "./context/HabitContext";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <RoutineProvider>
                    <HabitProvider>
                        <App />
                    </HabitProvider>
                </RoutineProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
);
