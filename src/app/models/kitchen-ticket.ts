export interface KitchenTicket {
  id: string;
  orderId: string;
  branchId: string;
  items: { name: string; qty: number; status: string }[];
  status: string;
  createdAt: Date;
}