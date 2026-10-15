import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AppearanceProvider } from "./context/AppearanceContext";
import { AuthProvider } from "./context/AuthContext";
import { PlanProvider } from "./context/PlanContext";
import { TodayProvider } from "./context/TodayContext";
import { TodoProvider } from "./context/TodoContext";
import ErrorBoundary from "./components/shell/ErrorBoundary";
import Launch from "./components/shell/Launch";
import { needsSession } from "./components/shell/navigation";
import Page from "./components/shell/Page";
import ScreenError from "./components/shell/ScreenError";
import SessionCheck from "./components/shell/SessionCheck";
// From their own files, not the components index: that would pull every control into the first download
import { ToastProvider } from "./components/ui/Toast";
import { TooltipProvider } from "./components/ui/Tooltip";

// The last resort, for an error nothing nearer caught (each screen has a boundary of its own inside the shell)
const appError = (error) => (
    <Page standalone>
        <ScreenError error={error} />
    </Page>
);

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <AppearanceProvider>
            <TooltipProvider>
                <ToastProvider>
                    <BrowserRouter>
                        <ErrorBoundary fallback={appError}>
                            <AuthProvider fallback={<SessionCheck />} needsSession={needsSession}>
                                <TodayProvider>
                                    <PlanProvider>
                                        <TodoProvider>
                                            <App />
                                        </TodoProvider>
                                    </PlanProvider>
                                </TodayProvider>
                            </AuthProvider>
                        </ErrorBoundary>
                    </BrowserRouter>
                    {/* Over all of it while the app opens */}
                    <Launch />
                </ToastProvider>
            </TooltipProvider>
        </AppearanceProvider>
    </StrictMode>,
);
