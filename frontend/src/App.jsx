import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
// import { Analytics } from "@vercel/analytics/react";

// Auth & Protection
import ProtectedRoute from "./routes/ProtectedRoute";
import AuthPage from "./pages/Auth/AuthPage";
import ForgotPasswordPage from "./pages/Auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/Auth/ResetPasswordPage";

// Layout & Pages
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import RoutinePage from "./pages/Routine/RoutinePage"; 
import HabitsPage from "./pages/Habits/HabitsPage";
import ProgressPage from "./pages/Progress/ProgressPage";
import ExpensesPage from "./pages/Expenses/ExpensesPage";

function App() {
    return (
        <>
            {/* <Analytics /> */}
            <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

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

            <Route
                path="/expenses"
                element={
                    <ProtectedRoute>
                        <AppLayout title="Expenses">
                            <ExpensesPage />
                        </AppLayout>
                    </ProtectedRoute>
                }
            />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </>
    );
}

export default App;
