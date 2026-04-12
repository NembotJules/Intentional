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

export interface DailyAction {
  id: string;
  goal_id: string;
  name: string;
  type: ActionType;
  target_minutes: number;
  reminder_time: string | null;
  is_active: number;
  sort_order: number;
}

export interface FocusSession {
  id: string;
  action_id: string;
  goal_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  note: string | null;
  was_completed: number;
}

/** US-030: joined row for session history list */
export interface SessionHistoryListItem extends FocusSession {
  action_name: string;
  goal_name: string;
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
  created_at: string;
}
