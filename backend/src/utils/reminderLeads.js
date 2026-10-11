// How long before a routine starts its reminder goes, in minutes. An account picks one (0: as it starts).
// Kept apart from reminders.js so the User model can use it without loading the job.
export const REMINDER_LEADS = [0, 5, 10, 15, 30, 60];
export const DEFAULT_REMINDER_LEAD = 10;
