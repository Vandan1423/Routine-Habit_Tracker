// What things are worth and what leaving them undone costs. These are the server's numbers
// (Habit.js, Routine.js, dailyPenaltyJob.js, routineController.js), repeated here only so that a form
// can say them before anything has been saved. What an item really paid always comes from the server.

// A habit's worth follows how hard it is
export const HABIT_XP = { easy: 10, medium: 15, hard: 25 };
// Every routine is worth the same
export const ROUTINE_XP = 10;

// Done more than a quarter of an hour after it ends, a routine pays half
export const LATE_GRACE_MINUTES = 15;
export const lateWorth = (xp) => Math.floor(xp / 2);

// Left undone when the day closes: a routine costs half of what it is worth, a habit a third
export const missCost = (kind, xp) => Math.floor(xp / (kind === "routine" ? 2 : 3));
