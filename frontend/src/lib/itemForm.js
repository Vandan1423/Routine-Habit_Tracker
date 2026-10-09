// The form a routine or a habit is made and changed in: what it starts with, what is wrong with it,
// and what is sent to the API. No React here, so the rules can be read (and checked) on their own.

import { daysOf } from "./plan";
import { parseTime, toMinutes } from "./time";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const MOST = 1000000; // the largest target the API takes

export const CATEGORIES = [
    { value: "personal", label: "Personal" },
    { value: "health", label: "Health" },
    { value: "fitness", label: "Fitness" },
    { value: "learning", label: "Learning" },
    { value: "work", label: "Work" },
    { value: "other", label: "Other" },
];

/**
 * A new item's form.
 * @param {String} kind - "routine" or "habit"
 * @param {Object} [start] - today: the day a one-off task starts out on; block: the part of the day a habit
 *   starts out in; once: a routine that starts out as a one-off task
 */
export const emptyForm = (kind, { today = "", block = "anytime", once = false } = {}) =>
    kind === "routine"
        ? {
              title: "",
              startTime: "",
              endTime: "",
              repeats: once ? "once" : "weekly",
              days: EVERY_DAY,
              date: today,
              category: "personal",
              description: "",
          }
        : {
              title: "",
              timeOfDay: block,
              days: EVERY_DAY,
              tracking: "boolean",
              target: "",
              unit: "",
              difficulty: "medium",
              category: "personal",
              description: "",
          };

// The form of an item that exists, as the API sent it
export const formOf = (kind, item, { today = "" } = {}) =>
    kind === "routine"
        ? {
              title: item.title ?? "",
              // Older routines were saved as "2:30 PM"
              startTime: parseTime(item.startTime ?? "") ?? "",
              endTime: parseTime(item.endTime ?? "") ?? "",
              repeats: item.isRecurring ? "weekly" : "once",
              days: item.isRecurring ? daysOf("routine", item) : EVERY_DAY,
              date: item.isRecurring ? today : (item.date ?? today),
              category: item.category ?? "personal",
              description: item.description ?? "",
          }
        : {
              title: item.title ?? "",
              timeOfDay: item.timeOfDay ?? "anytime",
              days: daysOf("habit", item),
              tracking: item.habitType === "quantity" ? "quantity" : "boolean",
              target: item.habitType === "quantity" ? String(item.targetQuantity ?? "") : "",
              unit: item.unit ?? "",
              difficulty: item.difficulty ?? "medium",
              category: item.category ?? "personal",
              description: item.description ?? "",
          };

// A target as typed ("20", "2.5", "10,000"), as a number, or NaN
export const readAmount = (text) => {
    const cleaned = String(text).trim().replace(/[,\s]/g, "");
    return cleaned === "" ? NaN : Number(cleaned);
};

/**
 * What is wrong with a form, by field. Empty when it can be saved.
 * @param {Object} [facts] - today: a one-off task cannot be set for a day before it;
 *   keepsDate: the date it was saved with, which may stay even if it is now in the past
 */
export const validate = (kind, form, { today = "", keepsDate = null } = {}) => {
    const errors = {};

    if (!form.title.trim()) errors.title = "Give it a name.";

    if (kind === "routine") {
        if (!form.startTime) {
            errors.startTime = "Choose when it starts.";
        } else if (form.endTime && toMinutes(form.endTime) <= toMinutes(form.startTime)) {
            errors.endTime = "The end has to come after the start.";
        }

        if (form.repeats === "weekly" && form.days.length === 0) {
            errors.days = "Choose at least one day.";
        }
        if (form.repeats === "once") {
            if (!form.date) {
                errors.date = "Choose a day.";
            } else if (today && form.date < today && form.date !== keepsDate) {
                errors.date = "Choose today or a later day.";
            }
        }
        return errors;
    }

    if (form.days.length === 0) errors.days = "Choose at least one day.";

    if (form.tracking === "quantity") {
        const target = readAmount(form.target);
        if (!(target > 0) || target > MOST) errors.target = "Enter a number above zero.";
    }

    return errors;
};

// What is sent to the API for a form that has passed validate
export const payloadOf = (kind, form) => {
    const shared = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
    };

    if (kind === "routine") {
        const weekly = form.repeats === "weekly";

        return {
            ...shared,
            startTime: form.startTime,
            endTime: form.endTime,
            isRecurring: weekly,
            recurringDays: weekly ? form.days : [],
            date: weekly ? null : form.date,
        };
    }

    const everyDay = form.days.length === 7;
    const counted = form.tracking === "quantity";

    return {
        ...shared,
        timeOfDay: form.timeOfDay,
        // No days listed is how the API writes "every day"
        frequency: everyDay ? "daily" : "weekly",
        targetDays: everyDay ? [] : form.days,
        habitType: counted ? "quantity" : "boolean",
        targetQuantity: counted ? readAmount(form.target) : 1,
        unit: counted ? form.unit.trim() : "",
        difficulty: form.difficulty,
    };
};

// True when two forms hold the same answers (so closing one loses nothing)
export const sameForm = (a, b) =>
    Object.keys(a).every((key) =>
        Array.isArray(a[key])
            ? a[key].length === b[key].length && a[key].every((value) => b[key].includes(value))
            : a[key] === b[key],
    );
