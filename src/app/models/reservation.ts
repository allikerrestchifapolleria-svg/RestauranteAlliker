export interface Reservation {
  id: string;
  branchId: string;
  tableId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: Date;
  time: Date | string;
  peopleCount: number;
  notes: string;
  status: string;
  createdAt: Date;
}