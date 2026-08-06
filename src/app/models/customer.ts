export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  favoriteItems: string[];
  totalOrders: number;
  lastOrderAt: Date | null;
  createdAt: Date;
}