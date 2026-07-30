export interface SaleItem {
  itemId: string;
  name: string;
  price: number;
  qty: number;
  tax: number;
  total: number;
}

export interface Sale {
  saleId: string;
  orderId: string;
  tableId: string | null;
  customerId: string | null;
  waiterId?: string;
  waiterName?: string;
  branchId: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  saleDate: Date;
  createdAt: Date;
}