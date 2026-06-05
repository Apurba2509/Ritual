import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSocialStore, ActivityItem } from '../stores/socialStore';
import { useUserStore } from '../stores/userStore';

export function useRealtime() {
  const { session } = useUserStore();
  const { addFeedItem, feed } = useSocialStore();

  useEffect(() => {
    if (!session?.user?.id) return;

    // Listen to inserts on activity_items
    const channel = supabase
      .channel('public:activity_items')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_items' },
        async (payload) => {
          const newItem = payload.new as ActivityItem;
          
          // Optionally, fetch user details to hydrate the feed item
          const { data: userData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newItem.user_id)
            .single();

          if (userData) {
            newItem.user = userData;
          }

          // In a real app, check if this user is a friend before adding
          addFeedItem(newItem);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, addFeedItem]);
}
