export type Department =
  | 'furniture'
  | 'decarts'
  | 'books'
  | 'fashion'
  | 'art_sculpture';

export type Priority = 'high' | 'standard' | 'low';

export type TriageRow = {
  thread_id: string;
  streak_box_key: string;
  streak_pipeline_key: string | null;
  streak_stage_key: string | null;
  streak_stage_name: string | null;
  subject: string;
  from_email: string | null;
  from_name: string | null;
  received_at: string;
  snippet: string | null;
  body_text: string | null;
  body_source: string | null;
  classification_id: string | null;
  classified_at: string | null;
  department: Department[];
  priority: Priority;
  effective_priority: Priority;
  rationale: string | null;
  model: string | null;
  last_polled_at: string | null;
  age_days: number;
};
