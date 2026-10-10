import { Navigate, useLocation } from "react-router-dom";
import SessionCheck from "../components/shell/SessionCheck";
import useAuth from "../hooks/useAuth";
import useLeftBehind from "../hooks/useLeftBehind";

// Lets a signed-in visitor through and sends anyone else to the sign-in page.
// By the time this renders the session has been checked (AuthProvider holds the app back until then).
// The address that was asked for goes along, so signing in leads back to it; someone who has just
// signed out by choice starts from the beginning instead.
export default function ProtectedRoute({ children }) {
    const { isAuthenticated, left } = useAuth();
    const location = useLocation();
    // Anything the last visit left unsent goes to the server first, so the screens open on a day that has it
    const caughtUp = useLeftBehind();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={left ? null : { from: location }} />;
    }

    if (!caughtUp) return <SessionCheck />;

    return children;
}
