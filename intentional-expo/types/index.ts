/**
 * GLOSSARY — UI words vs code names
 * See Intentional_goals_model.md § 3 for the full product model.
 *
 * | UI word    | Code type     | DB table        | Foreign key column on children |
 * |------------|---------------|-----------------|--------------------------------|
 * | **Pillar** | `MetaGoal`    | `meta_goals`    | `goal_id` (legacy name)       |
 * | **Goal**   | `Objective`   | `objectives`    | `objective_id`                |
 * | **Task**   | `Task`        | `tasks`         | `task_id`                     |
 * | **Habit**  | `DailyAction` | `daily_actions` | `action_id`                   |
 * | **Session**| `FocusSession`| `focus_sessions`| —                             |
 *
 * Rule: "Goal" means *pillar* in legacy code. The new goal entity is **Objective**.
 * Never introduce a new column called `goal_id` that means anything other than pillar.
 */

export type ActionType = 'habit' | 'session';

export interface MetaGoal {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  why_statement: string;
  is_archived: number;
}

/**
 * Pillar — a lifelong area of life you want to improve (Body, Craft, etc.).
 * Alias for MetaGoal. See Intentional_goals_model.md § 3.
 */
export type Pillar = MetaGoal;

export interface DailyAction {
  id: string;
  goal_id: string;
  name: string;
  type: ActionType;
  target_minutes: number;
  reminder_time: string | null;
  is_active: number;
  sort_order: number;
  objective_id: string | null;
  days_mask: number;
}

/**
 * Habit — a recurring block of focus time, on your calendar.
 * Alias for DailyAction. See Intentional_goals_model.md § 3.
 */
export type Habit = DailyAction;

export type ObjectiveStatus = 'planned' | 'active' | 'completed' | 'dropped';

/**
 * Objective — a specific outcome inside one pillar, with a finish line and a deadline.
 * UI "Goal". See Intentional_goals_model.md § 3.
 */
export interface Objective {
  id: string;
  pillar_id: string;
  title: string;
  done_when: string;
  deadline: string;
  status: ObjectiveStatus;
  metric_current: number | null;
  metric_target: number | null;
  metric_unit: string | null;
  /** Where the metric started (set on create), so "90 → 70 kg" and "0 → 5,000 €" both measure from the start. */
  metric_start?: number | null;
  sort_order: number;
  created_at: string;
  closed_at: string | null;
  close_note: string | null;
}

/**
 * Task — a definite step toward a goal (one-off work).
 * See Intentional_goals_model.md § 3.
 */
export interface Task {
  id: string;
  objective_id: string;
  title: string;
  estimate_minutes: number;
  planned_date: string | null;
  is_done: number;
  done_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface FocusSession {
  id: string;
  action_id: string | null; // US-070: nullable for pillar-only sessions
  goal_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  note: string | null;
  was_completed: number;
  task_id: string | null;
  objective_id: string | null;
}

/** US-030: joined row for session history list */
export interface SessionHistoryListItem extends FocusSession {
  action_name: string;
  goal_name: string;
  goal_color: string | null;
}

export interface HabitCompletion {
  id: string;
  action_id: string;
  date: string;
  completed: number;
}

export interface GoalWithActions extends MetaGoal {
  actions: DailyAction[];
}

export interface TodaySection {
  goal: MetaGoal;
  actions: DailyAction[];
}

/** US-036/037: Weekly Sunday reflection entry */
export interface WeeklyReview {
  id: string;
  week_start: string;
  went_well: string;
  improve: string;
  adjustments: string;
  goals_data: string | null; // US-072: JSON array of {objective_id, on_track: 'yes'|'behind'|'rethink', hours}
  created_at: string;
}
