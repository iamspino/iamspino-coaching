export type Role = 'trainer' | 'client';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  avatar_url: string | null;
  push_token: string | null;
}

export interface Trainer {
  id: string;
  business_name: string;
  plan: string;
  max_clients: number;
  trial_ends_at: string;
}

export interface Client {
  id: string;
  trainer_id: string;
  status: 'active' | 'paused' | 'archived';
  goal: string;
  birth_date: string | null;
  height_cm: number | null;
  sex: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'full_name' | 'avatar_url'>;
}

export interface Invite {
  code: string;
  full_name: string;
  email: string | null;
  created_at: string;
  accepted_by: string | null;
}

export interface Exercise {
  id: string;
  trainer_id: string | null;
  name: string;
  muscle_group: string;
  equipment: string;
  video_url: string | null;
  instructions: string;
}

export interface WeekOverride { sets?: number; reps?: string; load?: string }

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  superset: string;
  sets: number;
  reps: string;
  load: string;
  rest_seconds: number;
  tempo: string;
  notes: string;
  week_overrides: Record<string, WeekOverride>;
  exercises?: Exercise;
}

export interface Workout {
  id: string;
  program_id: string;
  name: string;
  position: number;
  notes: string;
  workout_exercises?: WorkoutExercise[];
}

export interface Program {
  id: string;
  trainer_id: string;
  client_id: string | null;
  name: string;
  description: string;
  weeks: number;
  status: 'draft' | 'active' | 'archived';
  start_date: string | null;
  sent_at: string | null;
  review_requested_at: string | null;
  created_at: string;
  updated_at: string;
  workouts?: Workout[];
}

export interface WorkoutLog {
  id: string;
  client_id: string;
  program_id: string | null;
  workout_id: string | null;
  workout_name: string;
  week: number;
  started_at: string;
  completed_at: string | null;
  feeling: number | null;
  notes: string;
  trainer_comment: string;
  set_logs?: SetLog[];
}

export interface SetLog {
  id: string;
  log_id: string;
  workout_exercise_id: string | null;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  load: number | null;
  done: boolean;
}

export interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface CheckIn {
  id: string;
  client_id: string;
  date: string;
  weight: number | null;
  body_fat: number | null;
  waist: number | null;
  hips: number | null;
  chest: number | null;
  arm: number | null;
  thigh: number | null;
  sleep: number | null;
  energy: number | null;
  stress: number | null;
  adherence: number | null;
  notes: string;
  photos: string[];
  trainer_feedback: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface ProgramReview {
  id: string;
  client_id: string;
  program_id: string | null;
  program_name: string;
  overall: number | null;
  difficulty: number | null;
  enjoyment: number | null;
  adherence: number | null;
  adherence_pct: number | null;
  stressors: string[];
  results: number | null;
  duration_ok: number | null;
  liked: string;
  disliked: string;
  pain: string;
  next_goal: string;
  days_per_week: number | null;
  session_minutes: number | null;
  notes: string;
  created_at: string;
}
