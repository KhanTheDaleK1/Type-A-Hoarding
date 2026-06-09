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
      const matchesMediaType = filters.mediaType === 'all' || item.mediaType === filters.mediaType;
      
      return matchesSearch && matchesRating && matchesMediaType;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'title':
          comparison = a.sortTitle.localeCompare(b.sortTitle);
          break;
        case 'dateAdded':
          comparison = b.dateAdded - a.dateAdded; // Newest first for date added
          break;
        case 'rating':
          comparison = b.personalRating - a.personalRating;
          break;
        case 'value':
          comparison = (b.estimatedValue || 0) - (a.estimatedValue || 0);
          break;
        default:
          comparison = a.sortTitle.localeCompare(b.sortTitle);
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
};
