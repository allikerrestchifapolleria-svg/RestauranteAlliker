import { Injectable } from '@angular/core';
import { collection, getDocs, query, where, orderBy, limit, startAfter, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Order } from '../models/order';

export interface OrderHistoryPage {
  orders: Order[];
  total: number;
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OrderHistoryService {

  async getOrdersPage(
    from: Date,
    to: Date,
    status: string = 'all',
    search: string = '',
    branchId: string = '',
    pageSize: number = 20,
    lastDoc: QueryDocumentSnapshot | null = null
  ): Promise<OrderHistoryPage> {
    try {
      const constraints: QueryConstraint[] = [];

      constraints.push(where('createdAt', '>=', from));
      constraints.push(where('createdAt', '<=', to));

      if (status !== 'all') {
        constraints.push(where('status', '==', status));
      }
      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      constraints.push(orderBy('createdAt', 'desc'));

      let q = query(collection(db, 'orders'), ...constraints, limit(pageSize + 1));

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const orders: Order[] = [];
      let lastVisible: QueryDocumentSnapshot | null = null;

      snapshot.forEach(doc => {
        try {
          const data = doc.data();
          orders.push({
            id: doc.id,
            branchId: data['branchId'] || '',
            tableId: data['tableId'] || null,
            customerId: data['customerId'] || null,
            waiterId: data['waiterId'] || undefined,
            waiterName: data['waiterName'] || undefined,
            type: data['type'] || '',
            status: data['status'] || '',
            items: data['items'] || [],
            subtotal: Number(data['subtotal']) || 0,
            tax: Number(data['tax']) || 0,
            total: Number(data['total']) || 0,
            paymentMethod: data['paymentMethod'] || '',
            paymentStatus: data['paymentStatus'] || '',
            notes: data['notes'] || '',
            orderNumber: data['orderNumber'] || undefined,
            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
            updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt'])
          } as Order);
          lastVisible = doc;
        } catch (itemError) {
          console.error('[ORDER HISTORY] Error mapeando orden', doc.id, itemError);
        }
      });

      const hasMore = orders.length > pageSize;
      if (hasMore) {
        orders.pop();
      }

      let filtered = orders;
      if (search && search.trim()) {
        const term = search.toLowerCase();
        filtered = orders.filter(o =>
          String(o.orderNumber || '').includes(term) ||
          String(o.tableId || '').includes(term)
        );
      }

      return {
        orders: filtered,
        total: filtered.length,
        lastDoc: hasMore ? lastVisible : null,
        hasMore
      };
    } catch (error) {
      console.error('[ORDER HISTORY] Error consultando historial:', error);
      return { orders: [], total: 0, lastDoc: null, hasMore: false };
    }
  }
}
