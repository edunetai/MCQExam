import type { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  university_id: string;
  email: string;
  role: 'admin' | 'student';
}

export interface Test {
  id: string;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
}

export interface QuestionOption {
    text: string;
    isCorrect: boolean;
}

export interface Question {
  id: string;
  test_id: string;
  question_text: string;
  options: QuestionOption[];
}

export type TestWithQuestions = Test & { questions: Question[] };

export interface TestSession {
    id: string; // Should be a constant, e.g., 'active_session'
    test_id: string | null;
    status: 'waiting' | 'started' | 'paused' | 'finished';
    duration_minutes: number;
    start_time: string | null;
    test_title?: string;
    last_paused_at: string | null;
    total_paused_duration_seconds: number;
}

export interface StudentAnswer {
    id?: string;
    session_id: string;
    student_id: string;
    question_id: string;
    selected_option_index: number;
}

export interface StudentResult {
    student: Profile;
    answers: StudentAnswer[];
    score: number;
    totalQuestions: number;
}

export interface AuditLog {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string;
  action: string;
  details: any;
}