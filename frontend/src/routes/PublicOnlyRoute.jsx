import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { HOME_PATH } from "../components/shell/navigation";

// For pages that only make sense signed out, such as sign-in: someone already signed in goes to the app
// instead. This is also what carries a visitor onward the moment they sign in: to the address they first
// asked for (ProtectedRoute hands it over), or to Today.
export default function PublicOnlyRoute({ children }) {
    const { isAuthenticated } = useAuth();
    const { state } = useLocation();

    if (isAuthenticated) {
        const from = state?.from;
        const to = from?.pathname ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}` : HOME_PATH;

        return <Navigate to={to} replace />;
    }

    return children;
}
