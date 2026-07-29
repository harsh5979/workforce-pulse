import { create } from 'zustand';

interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  clearQuery: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
  clearQuery: () => set({ query: '' }),
}));
