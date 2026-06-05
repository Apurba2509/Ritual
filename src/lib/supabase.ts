import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({
  id: 'supabase-auth-storage'
});



const mmkvStorageAdapter = {
  getItem: (key: string) => {
    const value = storage.getString(key);
    return value ? value : null;
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    if (typeof (storage as any).remove === 'function') {
      (storage as any).remove(key);
    } else if (typeof (storage as any).delete === 'function') {
      (storage as any).delete(key);
    } else if (typeof (storage as any).removeItem === 'function') {
      (storage as any).removeItem(key);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
