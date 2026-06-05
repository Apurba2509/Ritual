import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useSocial = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const feedQuery = useQuery({
    queryKey: ['activity_feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_items')
        .select(`
          *,
          profiles:user_id (username, avatar_url, level)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const friendsQuery = useQuery({
    queryKey: ['friends', session?.user?.id],
    queryFn: async () => {
      // Get accepted friends where current user is requester or addressee
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${session?.user?.id},addressee_id.eq.${session?.user?.id}`);
        
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  return { 
    feed: feedQuery.data, 
    isLoadingFeed: feedQuery.isLoading,
    friends: friendsQuery.data 
  };
};
