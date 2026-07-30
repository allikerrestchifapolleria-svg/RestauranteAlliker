export interface Branch {
  id: string;
  branchId: string;
  name: string;
  address: string;
  phone: string;
  openingHours: Record<string, { open: string; close: string }>; // e.g., { 'lunes': { open: '12:00', close: '22:00' } }
  status: string;
  createdAt: Date;
  updatedAt: Date;
}