export interface Promotion {
  id: string;
  active: boolean;
  appliesTo: Record<string, any>; // Map/object
  createdAt: Date;
  description: string;
  discountPercentage: number;
  image: string;
  title: string;
  type: string;
  updatedAt: Date;
  validDays: string[];
  validHours: { start: string; end: string };
}