export interface Notification {
  id: string;
  userId: string | null;
  targetRole: string[] | null;
  branchId: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readBy?: string[];
  createdAt: Date;
  expiresAt?: Date;
}