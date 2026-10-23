# Phone checklist: goals, tasks, habits & sessions
**Build:** branch `review/agents-pr23` (cloud agents' US-054 → US-074 + audit fixes) · **Date:** 2026-10-21

Everything below was verified in the browser by automated tests (typecheck, 139 unit tests, real-SQLite migration replay, 6 end-to-end suites). This list covers what only **a real phone** can confirm (look, feel, sound, vibration, native sheets) plus the main flows end to end.

Tick each box. If something is off, write what you saw next to it and send it to me.

---

## 0. Setup (2 min)
- [ ] Open Expo Go and scan the QR / enter `exp://172.20.10.5:8082` (iPhone hotspot on). The app opens with **no crash**.
- [ ] Your existing data is still there (pillars, habits, past hours). *This proves the database upgrade kept your history.*
- [ ] Settings → **Replay onboarding** (for section 1). Your data is kept.

## 1. Onboarding: first goal (5 min)
- [ ] After choosing pillars, the screen asks **"What would winning look like in 90 days?"** with 3 example chips for your first pillar.
- [ ] Pick or type a goal, choose **90 days**, then Next. For the second pillar, **Skip for now** works.
- [ ] The habit step offers durations **5 · 15 · 30 · 45 · 60 · 90 · Custom**, and there is no "Just check it off" option.
- [ ] The habit step says **"Works toward <your goal>"**.
- [ ] Close the app on the habit step and reopen it: your goal is **still there**.
- [ ] The pledge says **"… by <date 90 days from today>"**, the right date, not off by one day.
- [ ] The congratulations screen mentions the goal too.

## 2. Pillar & goal (5 min)
- [ ] Goals tab → tap a pillar. The goal card shows **title, "done when", progress bar, days left, pace, hours**.
- [ ] On a pillar with no goal, tap **Set a goal**. **Pick a date** opens a month grid that fits the screen, and past days can't be picked.
- [ ] Set a second goal on the same pillar: it is saved as **Next up**.
- [ ] Toggle **"This pillar runs on habits"** on a pillar: its "Set a goal" nudge disappears.
- [ ] Open a goal: the header shows **"Due <date> · N days left"**, pace, progress, **hours all time and this week**, and **Recent sessions** (no "coming soon").

## 3. Tasks (5 min)
- [ ] In a goal, add 3 tasks with different estimates (try **Custom**) and plans (**Today**, **Tomorrow**, **Pick date**).
- [ ] Each row shows "0 / 30 min · Today". The first open task has the **Next** label.
- [ ] Move a task up or down: the **Next** label follows.
- [ ] Tap a task: the edit form opens prefilled. Change its title → **Save task**.
- [ ] **Delete task** asks for confirmation (native dialog), then the task is **gone** (not shown as done).
- [ ] Tick a task: it moves to **"1 done"**, and the next one becomes **Next**.

## 4. Today (5 min)
- [ ] Each pillar with a goal shows a **goal line**: title · days left · thin progress bar · pace ("behind" is a soft gold, never red).
- [ ] The goal's **next task** card has ▶ and ○. Tick ○: the next task slides in.
- [ ] A task planned for an earlier day shows **"from <weekday>"**. Tap it → **Do today** clears the label.
- [ ] Habits show **"7:00 · 30 min"** (or "Anytime · 30 min") in time order. Only the next one says **"in X min"**.
- [ ] A habit scheduled only on other weekdays is **not shown and not counted** in "N of M done".
- [ ] Tap **Free session** → a **pillar picker** appears → pick one → Focus shows **"Free time · <Pillar>"**.
- [ ] At most **one "Set a goal" nudge** shows. **Not now** hides it, and it stays hidden after reopening.

## 5. Focus (5 min, the most important)
- [ ] From Today, ▶ on a task: the focus room starts with the timer running and the task name shown.
- [ ] **Pause** and **Resume** work.
- [ ] **End** → "Leave now?" → wait 5 s → **End anyway** → the end screen shows **"+Xm to <Goal>"**.
- [ ] **"Is this task done?" → Yes** shows a green "Task done", and the task is ticked on Today.
- [ ] Run a short **habit** session for a habit linked to a goal, then open the goal: its **hours went up**.
- [ ] Run a **free session**, then Settings → Session history: it's labelled **"Free time"** (not "Deleted action").
- [ ] Today's "**given to your pillars**" counts task and free-time minutes too.
- [ ] Start a task session, switch to another tab, come back: no time lost and no odd "free-session" entry. *(Not testable in the browser.)*

## 6. Goal completion & drop (3 min)
- [ ] In a goal, tap **Mark as achieved** → confirm → **confetti** fills the whole screen, Flick is proud, and you feel the vibration.
- [ ] Type a reflection → it's saved (reopen the goal to check).
- [ ] If the pillar had a "Next up" goal, you're offered **"Start next: <title>"** or **Not now**. Nothing starts on its own.
- [ ] **Drop goal** opens a sheet with a one-line reason. The wording is kind, with no red. Works on iPhone.
- [ ] Android back button closes these sheets (if you have an Android).

## 7. Habits (3 min)
- [ ] Edit an old "check" habit: it says **"Give it 15 min so it counts"**. Save → it's now a timed habit.
- [ ] The weekday picker won't let you turn off the last day.
- [ ] The habit list shows the schedule, e.g. **"Mon–Sat · 7:00 · 30 min"**.
- [ ] Give a habit a start time a few minutes from now on today's weekday, and lock the phone: the reminder arrives **only on scheduled days**. *(Check that a non-scheduled day stays silent tomorrow.)*
- [ ] No text anywhere says "action" (Goals tab, pillar page, Settings, Today).

## 8. Insights & weekly review (3 min)
- [ ] Insights → Week shows the **calendar week** (Monday → today).
- [ ] The goals section shows a sentence like **"At this pace you'll reach … around <date>"**, with no "unknown", "late" or "overdue".
- [ ] **Where it went** splits each pillar into **Goal work · Maintenance · Free time**.
- [ ] Weekly review: answer **On track?** for a goal, add a task for a day next week, **save**, reopen: the answer is still there and the task exists.
- [ ] Reviews history shows the goal summary.

## 9. Feel (2 min)
- [ ] Nothing is cut off or overlapping on your screen size; the keyboard doesn't cover inputs in the task form and the weekly review.
- [ ] Buttons respond to taps everywhere, including the new chips and sheets.

---

## 10. Habit-time alerts & one-tap focus (US-075 / US-076), works in Expo Go (10 min)
Set up: allow notifications; create a habit on **today's weekday** with a start time **2–3 minutes from now**, 30 min, on a pillar.
- [ ] Lock the phone. At the time: **"🔥 <Habit> · <Pillar>"** with "Time to start. 30 min." (or "…, apps blocked." if blocking is set up).
- [ ] Long-press the alert: you see **Start now · In 10 min · Skip today**.
- [ ] Tap it within 30 min: Intentional opens on **"Starting <habit> in 3…"**, then the session runs with the habit's 30 min.
- [ ] Do it again and press **Cancel** during the 3 s: the habit is only preselected, nothing runs.
- [ ] **In 10 min**: the app doesn't open; the alert comes back 10 min later. Snoozing a second time works, but a third time doesn't.
- [ ] **Skip today**: no more alert today for that habit, and it's back tomorrow on its days.
- [ ] Check the habit off before its time: no alert today.
- [ ] With a session already running, tap another habit's alert: **"Switch to …?"** with Keep current and Switch both working.
- [ ] Force-quit the app, then tap an alert: it opens on the habit once, and reopening the app later doesn't do it again.
- [ ] Settings → **Heads-up 10 min before a habit** ON: "<Habit> in 10 min" arrives 10 min before (tapping it does not auto-start).
- [ ] A habit scheduled on other weekdays gives no alert today.

## 11. Strict mode, apps blocked automatically (US-077), needs an EAS development build, not Expo Go
- [ ] Settings → pick the apps to block (allow Screen Time access).
- [ ] The habit form shows **"Block apps automatically"**, on by default.
- [ ] Create a habit at now+2 min (≥15 min long). Without opening Intentional, at the time, the picked apps show Apple's block screen.
- [ ] After the habit's duration, they open normally again.
- [ ] Opening Intentional during the window lands on that habit's session.
- [ ] **Skip today** or ending the session early lifts the block immediately, and it doesn't come back today.
- [ ] Turning the switch off for a habit means no block next time (only the alert).

---

**Not in this build yet:**
- "Skip today" and "Missed 7:00, do it now?" on the Today screen (US-078).
- Retention and social features (US-079 →).
