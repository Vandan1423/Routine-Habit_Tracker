import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                }}
            >
                <h2>Checking authentication...</h2>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
