import { PropsWithChildren, createContext, useMemo, useState } from 'react';

import type { SortByType } from '../components/explore-filter';

type ExploreFilterState = {
  selectedSubjects: string[];
  setSelectedSubjects: (selected: string[]) => void;
  selectedLevels: string[];
  setSelectedLevels: (selected: string[]) => void;
  selectedTerms: string[];
  setSelectedTerms: (selected: string[]) => void;
  sortBy: SortByType;
  setSortBy: (selected: SortByType) => void;
};

export const ExploreFilterContext = createContext<ExploreFilterState>({
  selectedSubjects: [],
  setSelectedSubjects: () => undefined,
  selectedLevels: [],
  setSelectedLevels: () => undefined,
  selectedTerms: [],
  setSelectedTerms: () => undefined,
  sortBy: '',
  setSortBy: () => undefined,
});

const ExploreFilterStateProvider = ({ children }: PropsWithChildren) => {
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortByType>('');

  const val = useMemo(
    () => ({
      selectedLevels,
      setSelectedLevels,
      selectedSubjects,
      setSelectedSubjects,
      selectedTerms,
      setSelectedTerms,
      sortBy,
      setSortBy,
    }),
    [selectedLevels, selectedSubjects, selectedTerms, sortBy]
  );

  return (
    <ExploreFilterContext.Provider value={val}>
      {children}
    </ExploreFilterContext.Provider>
  );
};

export default ExploreFilterStateProvider;
