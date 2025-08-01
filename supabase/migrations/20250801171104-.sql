-- Add new columns to milestone_data table for the requested fields
ALTER TABLE public.milestone_data 
ADD COLUMN IF NOT EXISTS planned_finish_date date,
ADD COLUMN IF NOT EXISTS baseline_finish_date date,
ADD COLUMN IF NOT EXISTS actual_finish_date date;

-- Update the existing due_date column comment for clarity
COMMENT ON COLUMN public.milestone_data.due_date IS 'Original planned date';
COMMENT ON COLUMN public.milestone_data.planned_finish_date IS 'Current planned finish date';
COMMENT ON COLUMN public.milestone_data.baseline_finish_date IS 'Baseline finish date';
COMMENT ON COLUMN public.milestone_data.actual_finish_date IS 'Actual finish date';