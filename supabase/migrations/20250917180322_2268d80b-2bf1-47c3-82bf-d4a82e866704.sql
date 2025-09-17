-- Create table for storing economic indices history
CREATE TABLE public.economic_indices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_type TEXT NOT NULL CHECK (index_type IN ('CDI', 'SELIC', 'IPCA')),
  date DATE NOT NULL,
  value DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_type, date)
);

-- Create table for storing manual projections
CREATE TABLE public.index_projections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_type TEXT NOT NULL CHECK (index_type IN ('CDI', 'SELIC', 'IPCA')),
  year INTEGER NOT NULL,
  projected_value DECIMAL(10,6) NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_type, year)
);

-- Enable Row Level Security
ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_projections ENABLE ROW LEVEL SECURITY;

-- Create policies for economic_indices (public read, admin write)
CREATE POLICY "Economic indices are viewable by everyone" 
ON public.economic_indices 
FOR SELECT 
USING (true);

CREATE POLICY "Economic indices can be inserted by authenticated users" 
ON public.economic_indices 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Economic indices can be updated by authenticated users" 
ON public.economic_indices 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create policies for index_projections (user-specific)
CREATE POLICY "Users can view their own projections" 
ON public.index_projections 
FOR SELECT 
USING (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Users can create their own projections" 
ON public.index_projections 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own projections" 
ON public.index_projections 
FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own projections" 
ON public.index_projections 
FOR DELETE 
USING (created_by = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_economic_indices_type_date ON public.economic_indices(index_type, date DESC);
CREATE INDEX idx_index_projections_type_year ON public.index_projections(index_type, year);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_economic_indices_updated_at
BEFORE UPDATE ON public.economic_indices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_index_projections_updated_at
BEFORE UPDATE ON public.index_projections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();