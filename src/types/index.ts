export type CollectionType = 'Movies' | 'Books' | 'Video Games' | 'Comics' | 'Music' | 'Toy Cars' | 'LEGO' | 'Wine' | 'Coins' | 'Art' | 'Action Figures' | 'Currency' | 'Board Games' | 'Magazines' | 'Trading Cards' | 'Custom';

export interface FieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'rating' | 'select';
  options?: string[]; // For select type
}

export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
  icon?: string;
  customFields: FieldDefinition[];
  createdAt: number;
  favorite?: boolean;
  pinned?: boolean;
}

export interface Item {
  id: string;
  collectionId: string;
  title: string;
  sortTitle: string; 
  mediaType?: string; 
  images: string[]; // Mandate: up to 4 images
  watched?: boolean; // For the 'Spinning Wheel' logic
  loanedStatus: boolean;
  loanedTo?: string;
  purchasePrice?: number;
  purchaseDate?: number;
  dateAdded: number;
  personalRating: number;
  storageLocation?: string;
  notes?: string;
  estimatedValue?: number;
  customData: Record<string, any>; // Stores data for customFields
}
