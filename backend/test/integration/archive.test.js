import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    addDays,
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import Routine from "../../src/models/Routine.js";
import RoutineLog from "../../src/models/RoutineLog.js";
import Habit from "../../src/models/Habit.js";
import HabitLog from "../../src/models/HabitLog.js";
import XPLog from "../../src/models/XPLog.js";
import { settleEndedDays } from "../../src/utils/dailyPenaltyJob.js";

// Retiring a routine or habit to Archive, and bringing it back: out of the plan without being let go of.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("archive", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const longAgo = new Date(Date.now() - 40 * DAY);

    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });

        return {
            client,
            user,
            routine: async (fields = {}) =>
                (await client.post("/routines", { title: "Study", startTime: "16:00", endTime: "20:00", isRecurring: true, recurringDays: EVERY_DAY, ...fields })).body,
            habit: async (fields = {}) =>
                (await client.post("/habits", { title: "Read", difficulty: "easy", ...fields })).body.habit,
            // Something that stays open, so that no day here is ever one with everything done
            keepDayOpen: () =>
                client.post("/routines", { title: "Stays open", startTime: "23:00", isRecurring: true, recurringDays: EVERY_DAY }),
            archive: async () => (await client.get("/archive")).body,
            todays: async () => (await client.get("/routines")).body.routines.map((entry) => entry._id),
            plan: async () => (await client.get("/routines/all")).body.routines.map((entry) => entry._id),
            // Makes it as if this was put in the plan long ago
            backdate: (model, id) => model.updateOne({ _id: id }, { createdAt: longAgo }),
            settle: async (days) =>
                settleEndedDays(await User.findById(user._id), new Date(Date.now() + days * DAY)),
            lostOn: async (day) =>
                (await XPLog.find({ user: user._id, "metadata.date": day, reason: /_missed$/ })).reduce(
                    (sum, entry) => sum + entry.amount,
                    0,
                ),
        };
    };

    it("needs a session", async () => {
        const stranger = createClient();
        const id = "a".repeat(24);

        assert.equal((await stranger.get("/archive")).status, 401);
        assert.equal((await stranger.post(`/routines/${id}/archive`)).status, 401);
        assert.equal((await stranger.post(`/habits/${id}/unarchive`)).status, 401);
    });

    it("takes a routine out of the plan into Archive, history and XP kept, and brings it back", async () => {
        const { client, user, routine, keepDayOpen, archive, todays, plan } = await setup();
        await keepDayOpen();
        const item = await routine();
        await RoutineLog.create([
            { routine: item._id, user: user._id, date: daysAgo(2), completedAt: "17:00", xpEarned: 10 },
            { routine: item._id, user: user._id, date: daysAgo(1), completedAt: "17:00", xpEarned: 10 },
        ]);
        await User.updateOne({ _id: user._id }, { xp: 300 });

        const retired = await client.post(`/routines/${item._id}/archive`);
        assert.equal(retired.status, 200);
        assert.ok(retired.body.archivedAt);
        assert.equal((await User.findById(user._id)).xp, 300);

        assert.equal((await todays()).includes(item._id), false);
        assert.equal((await plan()).includes(item._id), false);

        const { routines, habits } = await archive();
        assert.equal(habits.length, 0);
        assert.equal(routines.length, 1);
        assert.deepEqual(
            [routines[0]._id, routines[0].title, routines[0].timesDone, routines[0].isActive],
            [item._id, "Study", 2, false],
        );

        // Its past can still be looked at, but it can't be changed or ticked while it is retired
        const history = await client.get(`/routines/${item._id}/history`);
        assert.equal(history.status, 200);
        assert.equal(history.body.totals.done, 2);
        assert.equal((await client.put(`/routines/${item._id}`, { title: "Renamed" })).status, 404);
        assert.equal((await client.post(`/routines/${item._id}/complete`, {})).status, 404);
        assert.equal((await client.post(`/routines/${item._id}/archive`)).status, 404);

        const back = await client.post(`/routines/${item._id}/unarchive`);
        assert.equal(back.status, 200);
        assert.deepEqual([back.body.isActive, back.body.archivedAt], [true, null]);
        assert.equal((await todays()).includes(item._id), true);
        assert.equal((await archive()).routines.length, 0);
        assert.equal((await client.post(`/routines/${item._id}/unarchive`)).status, 404);
        assert.equal((await User.findById(user._id)).xp, 300);
    });

    it("does the same for a habit", async () => {
        const { client, habit, archive } = await setup();
        const item = await habit();
        await client.put(`/habits/${item._id}/log`, { quantity: 1 });

        assert.equal((await client.post(`/habits/${item._id}/archive`)).status, 200);
        assert.equal((await client.get("/habits")).body.habits.length, 0);
        const { habits } = await archive();
        assert.deepEqual([habits[0]._id, habits[0].timesDone], [item._id, 1]);
        assert.equal((await client.put(`/habits/${item._id}/log`, { quantity: 0 })).status, 404);

        const back = await client.post(`/habits/${item._id}/unarchive`);
        assert.equal(back.status, 200);
        assert.equal(back.body.habit._id, item._id);
        assert.equal((await client.get("/habits")).body.habits[0].todayLog.completed, true);
    });

    it("keeps a one-off task out of Archive: it is deleted instead", async () => {
        const { client, routine } = await setup();
        const task = await routine({ isRecurring: false, recurringDays: [], date: today });

        const refused = await client.post(`/routines/${task._id}/archive`);
        assert.equal(refused.status, 400);
        assert.match(refused.body.message, /one-off/);
    });

    it("still charges tonight for what was due today and not done, and nothing after", async () => {
        const { client, user, routine, keepDayOpen, backdate, settle, lostOn } = await setup();
        await User.updateOne({ _id: user._id }, { xp: 1000 });
        await keepDayOpen();
        const item = await routine();
        await backdate(Routine, item._id);

        const retired = await client.post(`/routines/${item._id}/archive`);
        assert.equal(retired.body.owed, 5);
        const owed = (await client.get("/streaks/info")).body.owed;
        assert.deepEqual(owed.map((entry) => [entry.title, entry.xp, entry.archived]), [["Study", 5, true]]);

        await settle(3);
        // Today: it and the routine that stays open. The two days after: only the one that stays open.
        assert.equal(await lostOn(today), -10);
        assert.equal(await lostOn(addDays(today, 1)), -5);
        assert.equal(await lostOn(addDays(today, 2)), -5);
    });

    it("costs nothing to retire what was made today, or what was already done today", async () => {
        const { client, routine, habit, backdate } = await setup();
        const fresh = await routine();
        const done = await habit();
        await backdate(Habit, done._id);
        await client.put(`/habits/${done._id}/log`, { quantity: 1 });

        assert.equal((await client.post(`/routines/${fresh._id}/archive`)).body.owed, 0);
        assert.equal((await client.post(`/habits/${done._id}/archive`)).body.owed, 0);
    });

    it("keeps the days it spent in Archive as days off, so its runs step over them", async () => {
        const { client, user, habit, backdate } = await setup();
        const item = await habit();
        await backdate(Habit, item._id);
        await HabitLog.create([
            { habit: item._id, user: user._id, date: daysAgo(6), completed: true },
            { habit: item._id, user: user._id, date: daysAgo(5), completed: true },
        ]);
        await client.post(`/habits/${item._id}/archive`);
        // As if it had been retired five days ago
        await Habit.updateOne({ _id: item._id }, { archivedAt: new Date(Date.now() - 5 * DAY) });

        const back = (await client.post(`/habits/${item._id}/unarchive`)).body.habit;
        assert.deepEqual(back.pauses, [{ from: daysAgo(4), until: daysAgo(1) }]);

        // Done again today: the run carries on from before it was retired
        const logged = (await client.put(`/habits/${item._id}/log`, { quantity: 1 })).body.habit;
        assert.equal(logged.currentStreak, 3);
        const history = (await client.get(`/habits/${item._id}/history`)).body;
        assert.equal(history.run.current, 3);
    });

    it("can be deleted from Archive to Trash, and recovering it puts it back in Archive", async () => {
        const { client, routine, archive, plan } = await setup();
        const item = await routine();
        await client.post(`/routines/${item._id}/archive`);

        const deleted = await client.delete(`/routines/${item._id}`);
        assert.equal(deleted.status, 200);
        assert.equal((await archive()).routines.length, 0);

        const trash = (await client.get("/trash")).body.items;
        assert.deepEqual(trash.map((entry) => [entry.id, entry.archived]), [[item._id, true]]);
        assert.equal((await client.get(`/routines/${item._id}/history`)).status, 404);

        const recovered = await client.post(`/trash/routine/${item._id}/restore`);
        assert.equal(recovered.status, 200);
        assert.equal(recovered.body.item.isActive, false);
        assert.equal((await archive()).routines.length, 1);
        assert.equal((await plan()).includes(item._id), false);
    });

    it("never shows one account's Archive to another, or lets it bring anything back", async () => {
        const owner = await setup();
        const other = await setup();
        const item = await owner.routine();
        await owner.client.post(`/routines/${item._id}/archive`);

        assert.equal((await other.archive()).routines.length, 0);
        assert.equal((await other.client.post(`/routines/${item._id}/unarchive`)).status, 404);
        assert.equal((await other.client.post(`/routines/${item._id}/archive`)).status, 404);
        assert.equal((await other.client.get(`/routines/${item._id}/history`)).status, 404);
    });
});
