CREATE TABLE public.card_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    card_title TEXT NOT NULL,
    analysis_area TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'melhoria' CHECK (category IN ('problema', 'melhoria', 'duvida', 'dados', 'elogio')),
    message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 3 AND 2000),
    task_title TEXT NOT NULL CHECK (char_length(btrim(task_title)) BETWEEN 1 AND 180),
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_triagem', 'convertido_em_task', 'descartado')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT card_feedback_card_id_length CHECK (char_length(btrim(card_id)) BETWEEN 1 AND 120),
    CONSTRAINT card_feedback_card_title_length CHECK (char_length(btrim(card_title)) BETWEEN 1 AND 160),
    CONSTRAINT card_feedback_analysis_area_length CHECK (char_length(btrim(analysis_area)) BETWEEN 1 AND 80)
);

CREATE INDEX idx_card_feedback_company_created_at
  ON public.card_feedback(company_id, created_at DESC);

CREATE INDEX idx_card_feedback_status_created_at
  ON public.card_feedback(status, created_at DESC);

CREATE INDEX idx_card_feedback_card_created_at
  ON public.card_feedback(card_id, created_at DESC);

CREATE INDEX idx_card_feedback_created_by
  ON public.card_feedback(created_by);

ALTER TABLE public.card_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback of their companies"
  ON public.card_feedback FOR SELECT
  TO authenticated
  USING ((SELECT public.user_can_access_company(company_id)));

CREATE POLICY "Users can insert feedback for their companies"
  ON public.card_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.user_can_access_company(company_id))
    AND created_by = (SELECT auth.uid())
  );
