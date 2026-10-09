// Where History lives: the month on show ("/history/2026-10") and one day of it ("/history/2026-10-03")
export const HISTORY_PATH = "/history";
export const monthPath = (month) => `${HISTORY_PATH}/${month}`;
export const dayPath = (day) => `${HISTORY_PATH}/${day}`;
