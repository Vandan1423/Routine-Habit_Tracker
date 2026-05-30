import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

// Auth & Protection
import ProtectedRoute from "./routes/ProtectedRoute";
import AuthPage from "./pages/Auth/AuthPage";

// Layout & Pages
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import RoutinePage from "./pages/Routine/RoutinePage"; 
import HabitsPage from "./pages/Habits/HabitsPage";
import ProgressPage from "./pages/Progress/ProgressPage";

function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<AuthPage />} />

            {/* Protected Routes */}
            {/* We wrap the AppLayout inside the ProtectedRoute so the layout itself is hidden from unauthenticated users */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <AppLayout title="Dashboard">
                            <DashboardPage />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            {/* Additional Protected Routes from your Sidebar */}
            <Route
                path="/routine"
                element={
                    <ProtectedRoute>
                        <AppLayout title="My Routine">
                            {/* 2. Swap out the placeholder for the actual component */}
                            <RoutinePage />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/habits"
                element={
                    <ProtectedRoute>
                        <AppLayout title="Habits">
                            <HabitsPage />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            <Route
                path="/progress"
                element={
                    <ProtectedRoute>
                        <AppLayout title="Progress">
                            <ProgressPage />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

export default App;
