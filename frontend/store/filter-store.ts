import { create } from 'zustand';

export interface FilterState {
  department: string | null;
  category: string | null;
  week: number | null;
  employeeId: string | null;
}

interface FilterActions {
  setDepartment: (dept: string | null) => void;
  setCategory: (cat: string | null) => void;
  setWeek: (week: number | null) => void;
  setEmployee: (id: string | null) => void;
  clearAll: () => void;
  toParams: () => Record<string, string | undefined>;
}

export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  department:  null,
  category:    null,
  week:        null,
  employeeId:  null,

  setDepartment: (dept) => set((s) => ({ department: s.department === dept ? null : dept })),
  setCategory:   (cat)  => set((s) => ({ category: s.category === cat ? null : cat })),
  setWeek:       (week) => set((s) => ({ week: s.week === week ? null : week })),
  setEmployee:   (id)   => set({ employeeId: id }),
  clearAll:      ()     => set({ department: null, category: null, week: null, employeeId: null }),

  toParams: () => {
    const s = get();
    return {
      department: s.department ?? undefined,
      category:   s.category   ?? undefined,
      week:       s.week != null ? String(s.week) : undefined,
    };
  },
}));

import { useMemo } from 'react';

export function useFilterParams() {
  const department = useFilterStore((s) => s.department);
  const category = useFilterStore((s) => s.category);
  const week = useFilterStore((s) => s.week);

  return useMemo(() => ({
    department: department ?? undefined,
    category: category ?? undefined,
    week: week ?? undefined,
  }), [department, category, week]);
}


