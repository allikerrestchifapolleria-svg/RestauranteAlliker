import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Order } from '../models/order';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, runTransaction, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.config';
import { NotificationService } from './notification';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor(
    private notificationService: NotificationService,
    private ngZone: NgZone,
    private auth: Auth
  ) {
    // BehaviorSubject emite el valor actual de forma sincrona al suscribirse,
    // por lo que el primer listenOrders() se dispara aqui mismo.
    this.auth.currentUser$.subscribe(() => this.listenOrders());
  }

  private ordersQuery() {
    const ordersCollection = collection(db, 'orders');
    const role = this.auth.getUserRole();
    const branchId = this.auth.getUserBranchId();
    if ((role === 'waiter' || role === 'cook') && branchId) {
      return query(ordersCollection, where('branchId', '==', branchId));
    }
    return ordersCollection;
  }

  private listenOrders() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }

    // Sin orderBy('createdAt') en la query: combinado con el where('branchId')
    // exigiria un indice compuesto en Firestore que quizas no existe. Se ordena
    // aqui en cliente tras mapear los documentos.
    this.unsubscribeSnapshot = onSnapshot(this.ordersQuery(), (snapshot) => {
      this.ngZone.run(() => {
        const orders: Order[] = [];
        snapshot.forEach(doc => {
          try {
            const data = doc.data();

            const order: Order = {
              id: doc.id,
              branchId: data['branchId'] || '',
              tableId: data['tableId'] || null,
              tableName: data['tableName'] || undefined,
              customerId: data['customerId'] || null,
              waiterId: data['waiterId'] ? String(data['waiterId']).trim() : undefined,
              waiterName: data['waiterName'] ? String(data['waiterName']).trim() : undefined,
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
            };

            orders.push(order);
          } catch (docError) {
            console.error('[ORDERS] Error procesando documento', doc.id, ':', docError);
          }
        });

        orders.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        this.ordersSubject.next(orders);
      });
    }, (error) => {
      console.error('[ORDERS] Error en listener en tiempo real:', error);
    });
  }

  async loadOrdersFromFirestore() {
    console.warn('[ORDERS] loadOrdersFromFirestore está obsoleto - usando onSnapshot en tiempo real');
  }

  getOrders(): Observable<Order[]> {
    return this.orders$;
  }

  getOrdersByDateRange(startDate: Date, endDate: Date): Observable<Order[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.orders$.pipe(
      map(orders => orders.filter(o => {
        const date = new Date(o.createdAt);
        return date >= start && date <= end;
      }))
    );
  }

  getOrderById(id: string): Observable<Order | undefined> {
    return new Observable(observer => {
      const orders = this.ordersSubject.value;
      const order = orders.find(o => o.id === id);
      observer.next(order);
      observer.complete();
    });
  }

  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string; orderNumber: number }> {
    if (!order.items || order.items.length === 0) {
      throw new Error('La orden debe tener al menos un item');
    }
    for (const item of order.items) {
      if (!item.name || item.name.trim() === '') {
        throw new Error('Cada item debe tener un nombre');
      }
      if (!item.qty || item.qty < 1) {
        throw new Error('Cada item debe tener una cantidad válida (mínimo 1)');
      }
      if (item.price === undefined || item.price === null || item.price <= 0) {
        throw new Error('Cada item debe tener un precio válido');
      }
    }
    if (!order.branchId) {
      throw new Error('La orden debe tener una sucursal asignada');
    }
    if (!order.type) {
      throw new Error('La orden debe tener un tipo válido');
    }
    try {
      const ordersCollection = collection(db, 'orders');
      const counterRef = doc(db, 'counters', 'orderCounter');

      const orderNumber = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextNumber = 1;
        if (counterSnap.exists()) {
          nextNumber = (counterSnap.data()['currentNumber'] || 0) + 1;
        }
        transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
        return nextNumber;
      });

      const dataToSave = {
        branchId: order.branchId,
        tableId: order.tableId,
        tableName: order.tableName || null,
        customerId: order.customerId,
        waiterId: order.waiterId || null,
        waiterName: order.waiterName || null,
        type: order.type,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes || '',
        orderNumber,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const docRef = await addDoc(ordersCollection, dataToSave);

      const newOrder: Order = {
        id: docRef.id,
        branchId: order.branchId,
        tableId: order.tableId,
        tableName: order.tableName,
        customerId: order.customerId,
        waiterId: order.waiterId,
        waiterName: order.waiterName,
        type: order.type,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes,
        orderNumber,
        createdAt: dataToSave.createdAt,
        updatedAt: dataToSave.updatedAt
      };
      const current = this.ordersSubject.value;
      const exists = current.some(o => o.id === newOrder.id);
      if (!exists) {
        this.ordersSubject.next([newOrder, ...current]);
      }

      return { id: docRef.id, orderNumber };
    } catch (error) {
      console.error('[ORDERS] Error creando orden:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    try {
      if (!orderId) {
        throw new Error('orderId es requerido');
      }

      if (!status) {
        throw new Error('status es requerido');
      }

      const orderDoc = doc(db, 'orders', orderId);
      const updateData = {
        status,
        updatedAt: new Date()
      };

      await updateDoc(orderDoc, updateData);

      const currentOrders = this.ordersSubject.value;
      const updatedOrders = currentOrders.map(o =>
        o.id === orderId ? { ...o, status, updatedAt: new Date() } : o
      );
      const order = currentOrders.find(o => o.id === orderId);

      this.ngZone.run(() => {
        this.ordersSubject.next(updatedOrders);
      });

      if (status === 'ready' && order) {
        const isTakeout = order.type === 'takeout';
        this.notificationService.createNotification({
          userId: isTakeout ? null : (order.waiterId || null),
          targetRole: isTakeout ? ['waiter', 'admin'] : ['waiter'],
          branchId: order.branchId,
          type: 'order_ready',
          title: 'Pedido Listo',
          message: `El pedido #${order?.orderNumber || orderId.slice(-6)} está listo para servir`,
          read: false
        });
      }

    } catch (error) {
      console.error('[ORDERS] Error actualizando estado:', error);
      throw error;
    }
  }

  async updateOrderPaymentStatus(
    orderId: string,
    paymentMethod: string,
    paymentStatus: string
  ): Promise<void> {
    try {
      if (!orderId) throw new Error('orderId es requerido');

      const orderDoc = doc(db, 'orders', orderId);
      const updateData = {
        paymentMethod,
        paymentStatus,
        updatedAt: new Date()
      };

      await updateDoc(orderDoc, updateData);

      const currentOrders = this.ordersSubject.value;
      const updatedOrders = currentOrders.map(order =>
        order.id === orderId
          ? { ...order, paymentMethod, paymentStatus, updatedAt: new Date() }
          : order
      );

      this.ordersSubject.next(updatedOrders);
    } catch (error) {
      console.error('[ORDERS] Error actualizando estado de pago:', error);
      throw error;
    }
  }

  getOrdersByStatus(status: Order['status']): Observable<Order[]> {
    return new Observable(observer => {
      const orders = this.ordersSubject.value.filter(order => order.status === status);
      observer.next(orders);
      observer.complete();
    });
  }

  getOrdersByTable(tableId: string): Observable<Order[]> {
    return new Observable(observer => {
      const orders = this.ordersSubject.value.filter(order => order.tableId === tableId);
      observer.next(orders);
      observer.complete();
    });
  }
}