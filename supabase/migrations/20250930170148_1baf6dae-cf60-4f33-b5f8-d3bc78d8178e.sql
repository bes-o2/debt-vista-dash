-- Enable Row Level Security on index_projections
ALTER TABLE public.index_projections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own projections
CREATE POLICY "Users can view their own projections"
ON public.index_projections
FOR SELECT
USING (auth.uid() = created_by);

-- Policy: Users can create their own projections
CREATE POLICY "Users can create their own projections"
ON public.index_projections
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Policy: Users can update their own projections
CREATE POLICY "Users can update their own projections"
ON public.index_projections
FOR UPDATE
USING (auth.uid() = created_by);

-- Policy: Users can delete their own projections
CREATE POLICY "Users can delete their own projections"
ON public.index_projections
FOR DELETE
USING (auth.uid() = created_by);