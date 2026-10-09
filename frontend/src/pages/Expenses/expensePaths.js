// Where Expenses lives: the month today is in ("/expenses"), or another one ("/expenses/2026-09")
export const EXPENSES_PATH = "/expenses";
export const expensesPath = (month, currentMonth) =>
    month === currentMonth ? EXPENSES_PATH : `${EXPENSES_PATH}/${month}`;
