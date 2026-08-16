import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useAIChatHistory() {
  return useInfiniteQuery({
    queryKey: ['ai-chat-history'],
    queryFn: async ({ pageParam = undefined }) => {
      return await api.getAIChatHistory(pageParam as string | undefined);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      // If there are fewer than 7 messages, we've reached the end
      if (lastPage.messages.length < 7) return undefined;
      return lastPage.nextCursor;
    },
    // Keep data fresh, no stale time since it's a chat
  });
}

export function useAIBriefing() {
  return useQuery({
    queryKey: ['ai-briefing'],
    queryFn: () => api.getAIBriefing(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
