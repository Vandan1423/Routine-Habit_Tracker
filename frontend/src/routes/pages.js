import { lazyPage } from "../lib/lazyPage";

// Every screen, each downloaded when it is first needed (or a moment before: see lazyPage).

// Inside the shell
export const TodayPage = lazyPage(() => import("../pages/Today/TodayPage"));
export const PlanPage = lazyPage(() => import("../pages/Plan/PlanPage"));
export const ItemPage = lazyPage(() => import("../pages/Plan/ItemPage"));
export const TodoPage = lazyPage(() => import("../pages/Todo/TodoPage"));
export const WeekPage = lazyPage(() => import("../pages/Week/WeekPage"));
export const GoalsPage = lazyPage(() => import("../pages/Goals/GoalsPage"));
export const InsightsPage = lazyPage(() => import("../pages/Insights/InsightsPage"));
export const HistoryPage = lazyPage(() => import("../pages/History/HistoryPage"));
export const ExpensesPage = lazyPage(() => import("../pages/Expenses/ExpensesPage"));
export const SettingsPage = lazyPage(() => import("../pages/Settings/SettingsPage"));
export const TrashPage = lazyPage(() => import("../pages/Trash/TrashPage"));
export const ArchivePage = lazyPage(() => import("../pages/Archive/ArchivePage"));

// On their own, outside the shell
export const SignInPage = lazyPage(() => import("../pages/Auth/SignInPage"));
export const SignUpPage = lazyPage(() => import("../pages/Auth/SignUpPage"));
export const ForgotPasswordPage = lazyPage(() => import("../pages/Auth/ForgotPasswordPage"));
export const ResetPasswordPage = lazyPage(() => import("../pages/Auth/ResetPasswordPage"));
export const VerifyEmailPage = lazyPage(() => import("../pages/Auth/VerifyEmailPage"));
export const PrivacyPage = lazyPage(() => import("../pages/Legal/PrivacyPage"));
export const ConnectPage = lazyPage(() => import("../pages/Auth/ConnectPage"));

// Every shared control in every state. Exists in development only: a production build leaves it out.
export const GalleryPage = import.meta.env.DEV
    ? lazyPage(() => import("../pages/Dev/GalleryPage"))
    : null;
