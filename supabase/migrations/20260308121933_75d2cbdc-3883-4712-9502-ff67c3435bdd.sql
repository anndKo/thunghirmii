ALTER TABLE public.rooms 
ADD COLUMN contract_content text DEFAULT NULL,
ADD COLUMN deposit_amount numeric DEFAULT NULL;