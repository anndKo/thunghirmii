
ALTER TABLE public.rooms
ADD COLUMN electricity_cost numeric DEFAULT NULL,
ADD COLUMN water_cost numeric DEFAULT NULL,
ADD COLUMN custom_services jsonb DEFAULT NULL;
