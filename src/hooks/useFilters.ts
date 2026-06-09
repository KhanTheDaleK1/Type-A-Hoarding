import type { Item } from '../types';

export interface FilterOptions {
  search: string;
  rating: number | null;
  loanedOnly: boolean;
  location: string;
  mediaType: string;
  sortBy: 'title' | 'dateAdded' | 'rating' | 'value';
  sortOrder: 'asc' | 'desc';
}

export const initialFilters: FilterOptions = {
  search: '',
  rating: null,
  loanedOnly: false,
  location: 'all',
  mediaType: 'all',
  sortBy: 'title',
  sortOrder: 'asc',
};

export const filterItems = (items: Item[], filters: FilterOptions): Item[] => {
  return items
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(filters.search.toLowerCase());
      const matchesRating = filters.rating === null || item.personalRating >= filters.rating;
      const matchesLoaned = !filters.loanedOnly || item.loanedStatus;
      const matchesLocation = filters.location === 'all' || item.storageLocation === filters.location;
      const matchesMediaType = filters.mediaType === 'all' || item.mediaType === filters.mediaType;
      
      return matchesSearch && matchesRating && matchesLoaned && matchesLocation && matchesMediaType;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'title':
          comparison = a.sortTitle.localeCompare(b.sortTitle);
          break;
        case 'dateAdded':
          comparison = a.dateAdded - b.dateAdded;
          break;
        case 'rating':
          comparison = b.personalRating - a.personalRating;
          break;
        case 'value':
          comparison = (b.estimatedValue || 0) - (a.estimatedValue || 0);
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
};
