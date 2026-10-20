
CREATE TABLE IF NOT EXISTS public.weekly_practice_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL
    REFERENCES public.ojt_programs(id) ON DELETE CASCADE,
  practice_date date NOT NULL,
  practice_name text NOT NULL,
  score numeric(5,2) NOT NULL
    CHECK (score >= 0 AND score <= 100),
  notes text,
  created_by uuid NOT NULL
    REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_practice_program
ON public.weekly_practice_scores(program_id);

ALTER TABLE public.weekly_practice_scores
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentor view practice"
ON public.weekly_practice_scores;

CREATE POLICY "Mentor view practice"
ON public.weekly_practice_scores
FOR SELECT TO authenticated
USING (public.is_mentor());

DROP POLICY IF EXISTS "Mentor insert practice"
ON public.weekly_practice_scores;

CREATE POLICY "Mentor insert practice"
ON public.weekly_practice_scores
FOR INSERT TO authenticated
WITH CHECK (
  public.is_mentor()
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Mentor update practice"
ON public.weekly_practice_scores;

CREATE POLICY "Mentor update practice"
ON public.weekly_practice_scores
FOR UPDATE TO authenticated
USING (public.is_mentor())
WITH CHECK (public.is_mentor());

DROP POLICY IF EXISTS "Mentor delete practice"
ON public.weekly_practice_scores;

CREATE POLICY "Mentor delete practice"
ON public.weekly_practice_scores
FOR DELETE TO authenticated
USING (public.is_mentor());
