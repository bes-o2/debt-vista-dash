-- Disable user projections temporarily by restricting RLS policies
-- Keep only SELECT policy for future use, disable INSERT/UPDATE/DELETE

-- Drop existing policies that allow users to modify projections
DROP POLICY IF EXISTS "Users can create their own projections" ON public.index_projections;
DROP POLICY IF EXISTS "Users can update their own projections" ON public.index_projections;
DROP POLICY IF EXISTS "Users can delete their own projections" ON public.index_projections;

-- Keep only the SELECT policy but make it more restrictive
-- For now, no one can view projections (will be re-enabled later when we implement system-wide projections)
DROP POLICY IF EXISTS "Users can view all projections" ON public.index_projections;

-- Add a comment explaining the temporary restriction
COMMENT ON TABLE public.index_projections IS 'Temporarily disabled for user projections. Will be re-enabled for system-wide projections in the future.';