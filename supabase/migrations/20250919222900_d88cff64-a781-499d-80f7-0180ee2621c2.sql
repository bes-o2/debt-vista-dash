-- Enable Row Level Security on the companies table
-- This fixes the security issue where policies exist but RLS is disabled
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;