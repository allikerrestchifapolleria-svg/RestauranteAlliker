import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, from, map } from 'rxjs';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Sale, SaleItem } from '../models/sale';

@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private salesSubject = new BehaviorSubject<Sale[]>([]);
  public sales$ = this.salesSubject.asObservable();
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor(private ngZone: NgZone) {
    this.listenSales();
  }

  private listenSales() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }
    const salesCollection = collection(db, 'sales');
    this.unsubscribeSnapshot = onSnapshot(salesCollection, (snapshot) => {
      this.ngZone.run(() => {
        const sales: Sale[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          sales.push({
            saleId: doc.id,
            ...data,
            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
            saleDate: data['saleDate']?.toDate ? data['saleDate'].toDate() : new Date(data['saleDate'])
          } as Sale);
        });
        this.salesSubject.next(sales);
      });
    }, (error) => {
      console.error('[SALES] Error en listener en tiempo real:', error);
    });
  }

  async createSale(saleData: Omit<Sale, 'saleId' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'sales'), {
        ...saleData,
        createdAt: Timestamp.now(),
        saleDate: Timestamp.fromDate(saleData.saleDate)
      });
      return docRef.id;
    } catch (error) {
      console.error('[SALES] Error creating sale:', error);
      throw error;
    }
  }

  getSales(): Observable<Sale[]> {
    return this.sales$;
  }

  getSalesByDateRange(startDate: Date, endDate: Date): Observable<Sale[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.sales$.pipe(
      map(sales => sales.filter(s => {
        const date = new Date(s.saleDate);
        return date >= start && date <= end;
      }))
    );
  }

  getTotalSales(): Observable<number> {
    return this.getSales().pipe(
      map(sales => sales.reduce((total, sale) => total + sale.total, 0))
    );
  }

  getSalesByPaymentMethod(): Observable<{ [key: string]: number }> {
    return this.getSales().pipe(
      map(sales => {
        const methods: { [key: string]: number } = {};
        sales.forEach(sale => {
          if (!methods[sale.paymentMethod]) {
            methods[sale.paymentMethod] = 0;
          }
          methods[sale.paymentMethod] += sale.total;
        });
        return methods;
      })
    );
  }

  getSalesByDateRangeAndBranch(startDate: Date, endDate: Date, branchId: string): Observable<Sale[]> {
    return this.getSalesByDateRange(startDate, endDate).pipe(
      map(sales => branchId ? sales.filter(s => s.branchId === branchId) : sales)
    );
  }
}