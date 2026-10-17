import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
// import { Analytics } from "@vercel/analytics/react";
import { HOME_PATH, OLD_PATHS } from "./components/shell/navigation";
import Shell from "./components/shell/SignedInShell";
import useAuth from "./hooks/useAuth";
import NotFoundPage, { NOT_FOUND_TITLE } from "./pages/NotFound/NotFoundPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicOnlyRoute from "./routes/PublicOnlyRoute";
import {
    ArchivePage,
    ConnectPage,
    ExpensesPage,
    ForgotPasswordPage,
    GalleryPage,
    GoalsPage,
    HistoryPage,
    InsightsPage,
    ItemPage,
    PlanPage,
    PrivacyPage,
    ResetPasswordPage,
    SettingsPage,
    SignInPage,
    SignUpPage,
    TodayPage,
    TodoPage,

    WeekPage,
    TrashPage,
    VerifyEmailPage,
} from "./routes/pages";

// An address that matches nothing: inside the shell for someone signed in, on its own for anyone else
const NotFoundRoute = () => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <NotFoundPage standalone />;
    }

    return (
        <Shell title={NOT_FOUND_TITLE}>
            <NotFoundPage />
        </Shell>
    );
};

function App() {
    return (
        <>
            {/* <Analytics /> */}
            {/* The pages outside the shell wait here while their code downloads; the shell has a skeleton of its own */}
            <Suspense fallback={null}>
                <Routes>
                    {/* On their own. The first two are for a visitor who is not signed in; the rest are for anyone. */}
                    <Route
                        path="/login"
                        element={
                            <PublicOnlyRoute>
                                <SignInPage />
                            </PublicOnlyRoute>
                        }
                    />
                    <Route
                        path="/signup"
                        element={
                            <PublicOnlyRoute>
                                <SignUpPage />
                            </PublicOnlyRoute>
                        }
                    />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                    <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    {/* Where Claude sends someone to let it into their account; asks them to sign in first */}
                    <Route path="/connect" element={<ConnectPage />} />
                    {GalleryPage && <Route path="/dev/ui/*" element={<GalleryPage />} />}

                    {/* Inside the shell, for someone signed in */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <Shell />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/today" element={<TodayPage />} />
                        <Route path="/plan" element={<PlanPage />} />
                        <Route path="/plan/routine/:id" element={<ItemPage kind="routine" />} />
                        <Route path="/plan/habit/:id" element={<ItemPage kind="habit" />} />
                        {/* One list by its id; the general list without one */}
                        <Route path="/todo/:listId?" element={<TodoPage />} />
                        <Route path="/week/:start?" element={<WeekPage />} />
                        <Route path="/goals" element={<GoalsPage />} />
                        <Route path="/insights" element={<InsightsPage />} />
                        {/* A month ("2026-10") or one day of it ("2026-10-03"); the month today is in without either */}
                        <Route path="/history/:when?" element={<HistoryPage />} />
                        {/* A month ("2026-09"); the month today is in without one */}
                        <Route path="/expenses/:month?" element={<ExpensesPage />} />
                        <Route path="/archive" element={<ArchivePage />} />
                        <Route path="/trash" element={<TrashPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>

                    {/* The addresses from before the redesign still work */}
                    <Route path="/" element={<Navigate to={HOME_PATH} replace />} />
                    {OLD_PATHS.map(([from, to]) => (
                        <Route key={from} path={from} element={<Navigate to={to} replace />} />
                    ))}

                    <Route path="*" element={<NotFoundRoute />} />
                </Routes>
            </Suspense>
        </>
    );
}

export default App;
