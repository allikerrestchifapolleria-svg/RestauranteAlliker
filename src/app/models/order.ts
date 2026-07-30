export interface Order {
  id: string;
  branchId: string;
  tableId: string | null;
  tableName?: string;
  customerId: string | null;
  waiterId?: string;
  waiterName?: string;
  type: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  orderNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  qty: number;
  modifiers: any[];
  variant?: { name: string; price: number };
  notes: string;
}