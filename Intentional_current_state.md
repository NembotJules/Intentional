# INTENTIONAL — What you can do right now

**Build:** Expo (React Native) · **Last updated:** 2026-04-13 (Wave 6 + RevenueCat stub)

> This document describes the app's current capabilities in plain language — what a real user sitting with the app on their phone can actually do today. It is updated every time a user story is shipped.

---

## Getting started

When you open Intentional for the very first time you land on a brutalist welcome screen. The app's philosophy is introduced through copy before asking you to configure anything: a stacked **INTENTIONAL** wordmark, the James Clear quote *"You don't rise to the level of your goals. You fall to the level of your systems,"* and a short paragraph explaining the idea. Two subsequent screens walk you through the core problem (goal apps you never open, task managers that keep you busy without asking why) and the three-level system the app uses to fix it (Meta Goals → Daily Actions → Focus Sessions). None of this requires any input — it is purely for context, and you can skip the problem screen at any time to jump straight into setup.

A seven-segment progress bar sits at the top of every onboarding screen. The active segment is highlighted in off-white (`#e8e4dc`), completed segments in dark grey, and upcoming ones in near-black, so you always know exactly where you are in the flow.

---

## Creating your goals and actions during setup

The final **System Ready** screen now shows a summary card for every pillar you created — not just the first one. Each card lists the goal's icon, name, and its first action with its type and target duration, so you can confirm your whole setup before committing.

Once you reach the setup step you name your first life pillar — a goal like *Physique*, *Skills*, or *Finances* — with a maximum of thirty characters. You pick a color from seven swatches; the selected color immediately propagates to the preview pill and the call-to-action button so everything feels cohesive. If you add more than one pillar, swatches that are already in use by another pillar dim and show a small ✕ so you can see at a glance which colors are taken.

You can add up to five pillars during onboarding by tapping **Add another pillar**. After you finish naming all your pillars, the action step cycles through each one in sequence. For each pillar you give its first daily action a name, choose whether it is a **Session** (time-based deep work) or a **Habit** (binary done/not-done), and if it is a session you set a target duration using preset chips (25 min, 45 min, 1 h, 90 min, 2 h) or by tapping **Custom** and typing any number of minutes you want. The step header shows which pillar you are configuring and how many remain (e.g., *Pillar 2 of 3*), and the Next button label previews the next pillar's name so you always know where you are. Every pillar's action is saved when you complete onboarding. The parent pillar is shown as a colored pill above the form throughout.

After setting up your first action you write a one-sentence *Why* statement for your first pillar — the personal reason you are investing in it. There is a 140-character counter, an example statement to reduce blank-page anxiety, and a **Skip for now** option. If you skip, the field remains editable later from the Goals screen. The final screen shows a geometric burst animation and confirms your system is ready.

The app saves your progress to device storage as you go. If you background the app mid-setup and relaunch later, you return to exactly the step you left on with all your data intact, including from the very first welcome screen. Once you complete onboarding the app never shows it again on launch — but you can replay the full flow from Settings at any time without losing any of your goals or session history.

---

## Managing your goals

The **Goals** tab is your permanent home for everything goal-related. It lists all your active pillars in order, each shown as a card with its color accent, icon, action count, and hours logged this week. Tapping a goal opens its full detail page.

The **Goal Detail** screen shows: the goal's icon and name with its accent color, a three-cell stat row (lifetime focus hours, current streak in days, personal best streak in days), your Why statement, the full list of actions, and a session history link. The current streak is today-aware — if you have already logged something today it counts, so you never see a streak falsely broken mid-day.

You can edit the goal's name, icon, color, and Why statement directly from this screen without going back to the Goals tab. Tap **Edit goal** in the top right to reveal the inline edit form. Changing the color or name propagates immediately to Today, Insights, and the Goals list when you return to those screens.

You can archive a goal directly from its detail page — tap the **Archive** button in the top right header. A confirmation sheet (iOS action sheet or Android alert) explains that all session history is kept; the goal simply disappears from Today and the Goals list. This is much faster than the previous swipe gesture on the Goals tab.

You can add a new goal at any time by tapping **+** in the Goals header or the floating button on the Today screen. The same creation form as onboarding opens: name, color, icon, Why statement, and the option to add actions immediately. Saving a goal with zero actions is perfectly valid — you can always add actions later.

To change the display order of your goals you long-press any goal card. The list enters reorder mode and up/down arrows appear next to each card. The new order is saved immediately and reflects everywhere — Today, Insights, and Focus all respect the same sequence. Tapping **Done** exits reorder mode.

If you want to archive a goal you no longer actively pursue, you swipe left on its card and confirm. The goal disappears from Today, Insights, and the Goals list, but none of your historical focus sessions are deleted. Archiving is not the same as deleting.

---

## Managing daily actions

Inside the edit sheet for any goal you can add, edit, and arrange that goal's actions. Each active action row shows up/down arrows so you can move it within the list; the new order is saved immediately and controls how actions appear on the Today screen. You can edit an action's name, type, and target duration at any time — previous sessions are not affected by these changes.

The Goal Detail screen provides an alternative, more focused way to manage actions. Tapping the pen icon on any action opens an embedded form on the same screen: you can change the name, switch between Session and Habit, adjust the target duration, and toggle the daily reminder — all without navigating away. The ↑/↓ arrow buttons on each active action row let you reorder them with single taps. A pause/resume button on the right of each row lets you deactivate or reactivate an action in one tap.

Each action in the composer has a **Daily reminder** toggle. Enabling it reveals an HH:MM time field; once saved, the app schedules a repeating local notification at that exact time every day, labelled with the action name and parent goal. Turning the toggle off or deactivating the action cancels the notification automatically. The clock icon and time appear as a small badge on the action row in the Goals editor and in the Settings all-actions list so you can see at a glance which actions have reminders active.

Deactivating an action hides it from Today and stops it counting toward your daily score, but preserves all its history and streak data. You can restore it at any time from the same edit sheet, where paused actions appear dimmed with a **Restore** button.

---

## The Today screen

Every day starts on the **Today** screen. It shows a greeting, the current date, your Today Score as a circular ring (0–100 % based on completed actions), and your full list of actions grouped under their parent goal headers, each group tinted with that goal's color. Any action with a current streak of two days or more shows a small 🔥 badge above it displaying the streak count, so your momentum is visible at a glance without leaving the screen. A motivational card at the bottom of the action list surfaces the action you are most consistent with, showing its real streak rather than placeholder text.

A horizontal filter strip below the header lets you narrow the action list to a single goal. If the selected goal later has no active actions the filter resets automatically to **All** so you are never left with an empty screen and a stale chip.

Each session-type action row shows a **START** button and a small progress bar tracking how many minutes you have already logged today against your target. Each habit-type action row has a toggle: one tap marks it done (the row dims to 45 % opacity and a checkmark appears), and tapping again within the same day undoes it. The Today Score updates immediately after every toggle or completed session.

If you have no goals or actions set up yet, Today shows a clear empty state — *"Start by adding your first pillar"* — with a **SET UP GOALS** button that takes you straight to the Goals tab. If you have goals but all actions are complete, it shows a celebration message instead.

Swiping left on any action row reveals a deactivate control. You can also pull-to-refresh the screen manually.

---

## Running a focus session

Tapping **START** on a session action navigates to a preparation screen where you can confirm or change the duration before committing. The same preset chips from onboarding are available (25 / 45 / 60 / 90 / 120 min), plus a **Custom** option with a numeric input for any duration from 1 to 999 minutes. The action's own target duration is pre-selected so you can start immediately if you have no preference.

If you switch to another tab while a session is running, the app automatically saves your elapsed time as a partial session before you leave. When you return to the Focus tab the timer has stopped and your time is already logged — no work is ever silently discarded.

Once you tap **Start Session** the screen switches to a full dark-mode focus view. The goal name and action name are visible at the top. A large countdown timer in the center counts down from your chosen duration to zero, displayed in MM:SS format for sessions under an hour and H:MM:SS for longer ones. A circular SVG ring surrounds the timer and fills clockwise as time elapses, colored with the goal's accent color.

You can **Pause** at any time to freeze the timer — paused time does not count toward session duration — and then **Resume** to continue. You can also **End** the session early; the app shows a confirmation dialog (*"End session? Your time will still be logged."*) and on confirmation saves the actual elapsed seconds to your goal. There is no minimum duration: even a thirty-second session is recorded.

A small badge on the focus screen indicates the app-blocking categories you have configured in Settings. In the current Expo build, actual system-level app blocking is not enforced — the timer and logging run fully, but the OS shield is not active. Blocking will be enabled in a future native build.

---

## Session complete

When the timer naturally reaches zero — or when you end early — the app navigates to a completion screen. A short geometric burst animation plays in the goal's color. The screen shows the exact time logged, the goal it was credited to, and your current streak for that action in days.

An optional note field lets you write up to 280 characters about what you worked on or how the session felt. If you leave it blank nothing is stored. If you write something it is saved permanently with the session record. Tapping **Back to Today** returns you to the main screen; the session minutes are immediately reflected in the action's progress bar.

---

## Session history

You can browse every past focus session from the Goals tab or from the Insights screen via a **Session history** link. The history view lets you filter by time range (this week, this month, all time) and by goal. Each entry shows the date and time, the action name, the goal it belonged to, how long the session lasted, whether it was completed or ended early, and any note you wrote afterward.

---

## Insights

The **Insights** tab gives you a visual read of where your time is actually going. Three summary cells at the top — total hours, daily average, and top goal — update whenever you switch between the time range options (**WK**, **MO**, **ALL**). This week is shown by default.

Below the summary, a horizontal bar chart displays one bar per active goal, colored with that goal's color and labeled with hours to one decimal place. The goal with the most hours always fills the full width; every other bar is proportional to it, so you can see relative effort at a glance.

A radar chart shows the balance of your effort across all your goals. A perfectly equal week produces a regular polygon; an imbalanced week produces an irregular shape — that visual tension is intentional friction to prompt reflection. Each vertex dot is colored with its goal's color.

At the bottom, streak cards show every active action, its current consecutive-day streak, and your personal best. Session actions build their streak from days with at least one logged session; habit actions build theirs from days you marked them done. A streak continues if you have already done something today even if it is early in the day; it breaks if you missed yesterday entirely.

If you have never logged a single session, Insights shows an empty state with a prompt to start your first session.

---

## Settings

The **Settings** tab is organized into four areas.

The **Blocked app categories** section lets you choose which app buckets would be shielded during focus sessions. Ten categories are available: Social, Games, Entertainment, Shopping, Reading & Reference, Health & Fitness, Productivity, Creativity, Education, and Finance. Your selections are saved and visible on the Focus screen. OS-level enforcement is deferred to a future native build; the preference store is live now.

The **All actions** section shows every action across every goal in a single flat list, grouped by goal header with the goal's color and icon. A flash icon on each row is a quick toggle — tapping it deactivates an active action or reactivates a paused one without opening the Goals editor. The reminder time (if set) is shown as a small badge on each row.

The **Weekly review** section has a toggle for the Sunday evening reminder, which fires every Sunday at 8:00 PM and takes you into the reflection screen. A shortcut button lets you jump straight to this week's review without waiting.

The **Data** section exposes two controls. **Export sessions as CSV** reads every focus session from the database and writes a CSV file to the device's cache, then opens the native iOS share sheet so you can send the file to Files, Mail, AirDrop, or any other app. The CSV includes one row per session with columns for date, goal name, action name, duration in minutes, whether the session was completed, and any note you added. **Delete all data** opens a confirmation modal that requires you to type the word DELETE before the destructive button becomes active. Confirming wipes every SQLite table — goals, actions, sessions, habits, weekly reviews, and settings — and returns the app to the onboarding welcome screen. This action is irreversible.

Settings also exposes a **Replay onboarding** control in its own section. Confirming it clears only the onboarding-complete flag and any in-progress draft — your goals, actions, and all session history are completely untouched. The next time you navigate to the app root you see the welcome screen again and can walk through the full flow.

---

## Weekly reviews

From either the Insights tab or the Settings tab you can navigate to the **Weekly Review** screen. It shows three open-ended text prompts — *What went well?*, *What would I improve?*, and *Goal adjustments for next week?* — for the current Monday-start week. You can type freely in any or all of the fields; none are required individually, but at least one must contain text to save. Tapping **Save Review** writes the entry to the local database. If you come back to the screen later in the same week your previous answers are pre-loaded so you can revise them.

A **View past reviews** link at the bottom of the write screen opens the review history, which lists every completed review in reverse chronological order. Each card shows the week label and your three responses. Past reviews are read-only — this is by design so you can trust the archive as a true record of how you thought at the time.

If you have enabled the Sunday evening notification (from Settings), you receive a push notification every Sunday at 8:00 PM prompting you to open the review screen.

---

## Goal wallpaper

From the Goal Detail screen, tapping **Create goal wallpaper** opens a sheet showing a full-phone-sized preview of your goal card — a dark-background image with the goal's icon, name, color accent, and your Why statement in italics. Two buttons appear at the bottom: **Share** opens the iOS share sheet so you can send the PNG anywhere, and **Save to Photos** requests photo library access (if not already granted) and writes the image directly to your Camera Roll. From there you can open the Photos app and set it as your lock screen wallpaper. The card is rendered at your device's full pixel density so it looks sharp on any display.

---

## Subscription and premium features

The app ships with an **Intentional Pro** paywall. Five features are reserved for subscribers: Goal Detail, Session History, Weekly Review, Daily Reminders, and the Goal Wallpaper generator. When a free user taps any of these, a full-screen paywall appears showing the feature list, a monthly plan ($4.99/month) and an annual plan ($29.99/year, equivalent to $2.50/month), and a Subscribe button.

After tapping Subscribe, the purchase is processed and the app immediately unlocks all premium features for the session. A **Restore purchases** button in Settings → Subscription re-validates any existing subscription so that reinstalling the app or switching devices does not require paying again.

The **Settings → Subscription** section always shows the current plan status (Free or Intentional Pro Active). In development builds a **DEV: Toggle premium** row lets you flip premium on/off locally to test both states without going through a real purchase.

> Note: the RevenueCat SDK integration is stubbed. The purchase and restore calls simulate the real RevenueCat API shape (1–2 second delay + mock success) but do not contact any payment server. To go live: install `react-native-purchases`, create an app at [app.revenuecat.com](https://app.revenuecat.com), and replace the stub bodies in `services/purchases.ts` with real `Purchases.*` calls. No other files need changing.

---

## What is not available yet

The following features are planned but not yet built into this build:

- **Real app blocking** during focus sessions (requires a native EAS build with Apple's FamilyControls framework).
- **Home screen widget** showing Today Score.
- **RevenueCat API keys** — paywall UI is complete; wire in real keys once the RevenueCat account is set up.
- **iCloud sync**.

---

*End of current state overview. Updated in sync with `Intentional_acceptance_verification.md`.*
