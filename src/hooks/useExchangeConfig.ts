// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExchangeFeature {
  enabled: boolean;
  points: number;
}

export interface ExchangeConfig {
  enabled: boolean;
  features: Record<string, ExchangeFeature>;
}

const DEFAULT_CONFIG: ExchangeConfig = { enabled: false, features: {} };

let cachedConfig: ExchangeConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

export function useExchangeConfig() {
  const [config, setConfig] = useState<ExchangeConfig>(cachedConfig || DEFAULT_CONFIG);

  useEffect(() => {
    if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) {
      setConfig(cachedConfig);
      return;
    }
    supabase.from('settings').select('value').eq('key', 'points_exchange_config').maybeSingle()
      .then(({ data }) => {
        const val = (data?.value as ExchangeConfig) || DEFAULT_CONFIG;
        cachedConfig = val;
        cacheTime = Date.now();
        setConfig(val);
      });
  }, []);

  return config;
}

export function invalidateExchangeCache() {
  cachedConfig = null;
  cacheTime = 0;
}
