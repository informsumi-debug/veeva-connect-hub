-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create veeva_configurations table for storing Veeva CTMS settings
CREATE TABLE public.veeva_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  configuration_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  veeva_url TEXT NOT NULL,
  username TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync TIMESTAMP WITH TIME ZONE
);

-- Create veeva_sessions table for managing active sessions
CREATE TABLE public.veeva_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id UUID NOT NULL REFERENCES public.veeva_configurations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create study_data table for caching Veeva study information
CREATE TABLE public.study_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id UUID NOT NULL REFERENCES public.veeva_configurations(id) ON DELETE CASCADE,
  study_id TEXT NOT NULL,
  study_name TEXT NOT NULL,
  phase TEXT,
  status TEXT,
  data JSONB,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create milestone_data table for storing milestone information
CREATE TABLE public.milestone_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id UUID NOT NULL REFERENCES public.veeva_configurations(id) ON DELETE CASCADE,
  study_id TEXT,
  site_id TEXT,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date DATE,
  progress INTEGER DEFAULT 0,
  assigned_to TEXT,
  priority TEXT DEFAULT 'medium',
  data JSONB,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veeva_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veeva_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for veeva_configurations
CREATE POLICY "Users can view their own configurations" 
ON public.veeva_configurations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own configurations" 
ON public.veeva_configurations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configurations" 
ON public.veeva_configurations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configurations" 
ON public.veeva_configurations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for veeva_sessions
CREATE POLICY "Users can view sessions for their configurations" 
ON public.veeva_sessions 
FOR SELECT 
USING (
  configuration_id IN (
    SELECT id FROM public.veeva_configurations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage sessions for their configurations" 
ON public.veeva_sessions 
FOR ALL 
USING (
  configuration_id IN (
    SELECT id FROM public.veeva_configurations WHERE user_id = auth.uid()
  )
);

-- Create RLS policies for study_data
CREATE POLICY "Users can view study data for their configurations" 
ON public.study_data 
FOR SELECT 
USING (
  configuration_id IN (
    SELECT id FROM public.veeva_configurations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage study data for their configurations" 
ON public.study_data 
FOR ALL 
USING (
  configuration_id IN (
    SELECT id FROM public.veeva_configurations WHERE user_id = auth.uid()
  )
);

-- Create RLS policies for milestone_data
CREATE POLICY "Users can view milestone data for their configurations" 
ON public.milestone_data 
FOR SELECT 
USING (
  configuration_id IN (
    SELECT id FROM public.veeva_configurations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage milestone data for their configurations" 
ON public.milestone_data 
FOR ALL 
USING (
  configuration_id IN (
    SELECT id FROM public.veeva_configurations WHERE user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_veeva_configurations_updated_at
BEFORE UPDATE ON public.veeva_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestone_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.veeva_sessions;