import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Table } from '../models/table';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class TableService {
  private tablesSubject = new BehaviorSubject<Table[]>([]);
  public tables$ = this.tablesSubject.asObservable();
  private loaded = false;
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor(private ngZone: NgZone) {
    this.listenTables();
  }

  private listenTables() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }
    const tablesCollection = collection(db, 'tables');
    this.unsubscribeSnapshot = onSnapshot(tablesCollection, (snapshot) => {
      this.ngZone.run(() => {
        const tables: Table[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          tables.push({
            id: doc.id,
            branchId: data['branchId'] || '',
            name: data['name'] || '',
            number: data['number'] || 0,
            status: data['status'] || 'free',
            currentOrderId: data['currentOrderId'] || null,
            capacity: data['capacity'] || 4,
            occupiedTime: data['occupiedTime'] ? (data['occupiedTime'] instanceof Date ? data['occupiedTime'] : (data['occupiedTime'].toDate ? data['occupiedTime'].toDate() : new Date(data['occupiedTime']))) : null,
            familyGroupId: data['familyGroupId'] || null,
            permanentFamily: data['permanentFamily'] || false,
            reservationTime: data['reservationTime'] || undefined,
            reservationId: data['reservationId'] || null,
            reservedUntil: data['reservedUntil'] ? (data['reservedUntil'].toDate ? data['reservedUntil'].toDate() : new Date(data['reservedUntil'])) : null,
            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
            updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt'])
          } as Table);
        });
        this.tablesSubject.next(tables);
      });
    }, (error) => {
      console.error('[TABLE] Error en listener en tiempo real:', error);
    });
  }

  private async loadTablesFromFirestore() {
    try {
      const tablesCollection = collection(db, 'tables');
      const tablesSnapshot = await getDocs(tablesCollection);
      const tables: Table[] = [];
      tablesSnapshot.forEach(doc => {
        const data = doc.data();
        tables.push({
          id: doc.id,
          branchId: data['branchId'] || '',
          name: data['name'] || '',
          number: data['number'] || 0,
          status: data['status'] || 'free',
          currentOrderId: data['currentOrderId'] || null,
          capacity: data['capacity'] || 4,
          occupiedTime: data['occupiedTime'] ? (data['occupiedTime'] instanceof Date ? data['occupiedTime'] : (data['occupiedTime'].toDate ? data['occupiedTime'].toDate() : new Date(data['occupiedTime']))) : null,
            familyGroupId: data['familyGroupId'] || null,
            permanentFamily: data['permanentFamily'] || false,
            reservationTime: data['reservationTime'] || undefined,
            reservationId: data['reservationId'] || null,
            reservedUntil: data['reservedUntil'] ? (data['reservedUntil'].toDate ? data['reservedUntil'].toDate() : new Date(data['reservedUntil'])) : null,
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt'])
        } as Table);
      });

      console.log('Loaded tables from Firestore:', tables);
      this.ngZone.run(() => this.tablesSubject.next(tables));
    } catch (error) {
      console.error('Error loading tables from Firestore:', error);
    }
  }

  getTables(): Observable<Table[]> {
    return this.tables$;
  }

  async getLoadedTables(): Promise<Table[]> {
    if (this.tablesSubject.value.length > 0) {
      return this.tablesSubject.value;
    }
    if (!this.loaded) {
      this.loaded = true;
      await this.loadTablesFromFirestore();
    } else {
      await this.loadTablesFromFirestore();
    }
    return this.tablesSubject.value;
  }


  getTableById(id: string): Observable<Table | undefined> {
    return new Observable(observer => {
      const tables = this.tablesSubject.value;
      const table = tables.find(t => t.id === id);
      observer.next(table);
      observer.complete();
    });
  }

  async createTable(table: Omit<Table, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      console.log('TableService.createTable called with:', table);
      const tablesCollection = collection(db, 'tables');
      const dataToSave = {
        ...table,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      console.log('Data to save to Firestore:', dataToSave);
      const docRef = await addDoc(tablesCollection, dataToSave);
      console.log('Table created with ID:', docRef.id);
      // Reload tables to include the new one
      await this.loadTablesFromFirestore();
      console.log('Tables reloaded from Firestore after create');
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
    }
  }

  /**
   * Protege una reserva confirmada de perderse cuando la mesa se reutiliza
   * un turno extra antes de que lleguen los comensales reservados.
   *
   * Flujo esperado: mesa 'reserved' -> mesero libera explícitamente para
   * sentar a otro grupo (se deja pasar, currentStatus === 'reserved') ->
   * ese grupo termina y la mesa pasa a 'maintenance'/'occupied' -> al
   * intentar liberarla de nuevo (currentStatus YA NO es 'reserved') se
   * reclama como 'reserved' en vez de quedar libre, mientras la reserva
   * (reservationId/reservedUntil) siga vigente. Así no queda expuesta a
   * otra reserva online ni a que un mesero la ocupe por error, justo antes
   * de que lleguen los comensales confirmados.
   */
  private guardAgainstReleasingReservedTable(current: Table | undefined, updates: Partial<Table>): Partial<Table> {
    const targetsFree = updates.status === 'available' || updates.status === 'free';
    if (!targetsFree || !current) return updates;

    const isExplicitOverrideFromReserved = current.status === 'reserved';
    const hasLiveReservation = !!current.reservationId && !!current.reservedUntil &&
      new Date(current.reservedUntil).getTime() > Date.now();

    if (isExplicitOverrideFromReserved || !hasLiveReservation) return updates;

    return { ...updates, status: 'reserved' };
  }

  async updateTable(id: string, updates: Partial<Table>): Promise<void> {
    try {
      const tableDoc = doc(db, 'tables', id);
      const current = this.tablesSubject.value.find(t => t.id === id);
      const finalUpdates = this.guardAgainstReleasingReservedTable(current, updates);
      const dataToUpdate = {
        ...finalUpdates,
        updatedAt: new Date()
      };
      await updateDoc(tableDoc, dataToUpdate);
      // Update local state
      const currentTables = this.tablesSubject.value;
      const updatedTables = currentTables.map(table =>
        table.id === id ? { ...table, ...finalUpdates, updatedAt: new Date() } : table
      );
      this.ngZone.run(() => this.tablesSubject.next(updatedTables));
    } catch (error) {
      console.error('Error updating table:', error);
      throw error;
    }
  }

  async deleteTable(id: string): Promise<void> {
    try {
      const tableDoc = doc(db, 'tables', id);
      await deleteDoc(tableDoc);
      // Update local state
      const currentTables = this.tablesSubject.value;
      const filteredTables = currentTables.filter(table => table.id !== id);
      this.ngZone.run(() => this.tablesSubject.next(filteredTables));
    } catch (error) {
      console.error('Error deleting table:', error);
      throw error;
    }
  }

  getTableDisplayName(tableId: string | null): string | null {
    if (!tableId) return null;

    // Family table ID: fam_<groupId>
    if (tableId.startsWith('fam_')) {
      const groupId = tableId.slice(4);
      const children = this.tablesSubject.value.filter(t => t.familyGroupId === groupId);
      if (children.length > 0) {
        return children.map(c => c.name).join(' + ');
      }
      return null;
    }

    // El selector de reservas guarda el id del documento de Firestore, mientras
    // que los pedidos guardan el numero de mesa. Se prueba primero por id, que
    // es el identificador real: Number('MPF7wPI60M9ZAgY6kxrz') es NaN y antes
    // caia directo al `return null` del final.
    const tableById = this.tablesSubject.value.find(t => t.id === tableId);
    if (tableById) {
      return tableById.name;
    }

    // Regular table: match by number
    const num = Number(tableId);
    if (!isNaN(num)) {
      const table = this.tablesSubject.value.find(t => t.number === num);
      return table ? table.name : null;
    }

    return null;
  }
}
