export interface Table {
  id: string;
  branchId: string;
  name: string;
  number: number;
  status: string;
  currentOrderId: string | null;
  capacity: number;
  occupiedTime?: Date | null;
  reservationTime?: string | null;
  familyGroupId?: string | null;
  permanentFamily?: boolean;
  // Set when a confirmed reservation locks this table (see confirm-reservation
  // Netlify function). reservationTime is the reservation's start; reservedUntil
  // is when the auto-release job frees the table again.
  reservationId?: string | null;
  reservedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}