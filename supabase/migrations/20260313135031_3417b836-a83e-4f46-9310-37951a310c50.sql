
CREATE OR REPLACE FUNCTION public.cleanup_expired_top_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reset priority to 0 for rooms whose top orders have expired
  UPDATE public.rooms
  SET priority = 0
  WHERE priority > 0
    AND id IN (
      SELECT DISTINCT o.room_id
      FROM public.top_orders o
      WHERE o.status = 'approved'
        AND o.expires_at IS NOT NULL
        AND o.expires_at < now()
        AND o.room_id = rooms.id
        AND NOT EXISTS (
          SELECT 1 FROM public.top_orders o2
          WHERE o2.room_id = o.room_id
            AND o2.status = 'approved'
            AND (o2.expires_at IS NULL OR o2.expires_at >= now())
        )
    );
    
  -- Also update expired top_orders status
  UPDATE public.top_orders
  SET status = 'expired'
  WHERE status = 'approved'
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;
