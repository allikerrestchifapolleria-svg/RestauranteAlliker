import { Injectable } from '@angular/core';
import {
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { Order } from '../models/order';

/** Valor que representa "sin filtro de estado" en la consulta del historial. */
export const ORDER_HISTORY_ANY_STATUS = 'all';

/** Ultimo documento leido de una pagina; `null` significa "empezar desde el principio". */
export type OrderHistoryCursor = QueryDocumentSnapshot | null;

export interface OrderHistoryQuery {
  from: Date;
  to: Date;
  status?: string;
  branchId?: string;
  pageSize?: number;
  cursor?: OrderHistoryCursor;
}

export interface OrderHistoryPage {
  orders: Order[];
  /** Cursor con el que se pide la pagina siguiente; `null` cuando ya no hay mas. */
  nextCursor: OrderHistoryCursor;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

@Injectable({
  providedIn: 'root'
})
export class OrderHistoryService {

  /**
   * Lee una pagina del historial ordenada por fecha descendente.
   *
   * Solo aplica los filtros que Firestore resuelve en servidor (rango de fechas,
   * estado y sucursal); la busqueda por texto es responsabilidad de la vista porque
   * Firestore no soporta coincidencias parciales.
   *
   * Los errores se propagan para que la vista pueda explicarlos (indice faltante,
   * permisos, etc.) en lugar de mostrar un listado vacio sin motivo.
   */
  async getOrdersPage(request: OrderHistoryQuery): Promise<OrderHistoryPage> {
    const pageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
    const constraints = this.buildConstraints(request);

    // Se pide un documento extra para saber si existe una pagina siguiente.
    let pageQuery = query(collection(db, 'orders'), ...constraints, limit(pageSize + 1));
    if (request.cursor) {
      pageQuery = query(pageQuery, startAfter(request.cursor));
    }

    const snapshot = await getDocs(pageQuery);
    const hasMore = snapshot.docs.length > pageSize;
    const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

    return {
      orders: pageDocs.map(doc => this.toOrder(doc)),
      // El cursor debe ser el ultimo documento devuelto, nunca el extra de sondeo:
      // apuntar al extra hacia que la pagina siguiente se saltara una orden.
      nextCursor: hasMore ? pageDocs[pageDocs.length - 1] : null,
      hasMore
    };
  }

  private buildConstraints({ from, to, status, branchId }: OrderHistoryQuery): QueryConstraint[] {
    const constraints: QueryConstraint[] = [
      where('createdAt', '>=', from),
      where('createdAt', '<=', to)
    ];

    if (status && status !== ORDER_HISTORY_ANY_STATUS) {
      constraints.push(where('status', '==', status));
    }
    if (branchId) {
      constraints.push(where('branchId', '==', branchId));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    return constraints;
  }

  private toOrder(snapshot: QueryDocumentSnapshot): Order {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      branchId: data['branchId'] || '',
      tableId: data['tableId'] || null,
      tableName: data['tableName'] || undefined,
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
      createdAt: this.toDate(data['createdAt']),
      updatedAt: this.toDate(data['updatedAt'])
    };
  }

  /** Normaliza Timestamp de Firestore, Date o string. Nunca devuelve una fecha invalida:
   *  `DatePipe` lanza una excepcion con `Invalid Date` y tumbaria toda la tabla. */
  private toDate(value: unknown): Date {
    if (value instanceof Date) return value;

    const timestamp = value as { toDate?: () => Date } | null | undefined;
    if (typeof timestamp?.toDate === 'function') return timestamp.toDate();

    const parsed = new Date(value as string | number);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
}
