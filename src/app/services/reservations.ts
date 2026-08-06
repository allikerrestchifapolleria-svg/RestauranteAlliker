import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Reservation } from '../models/reservation';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.config';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root'
})
export class ReservationsService {
  private reservationsSubject = new BehaviorSubject<Reservation[]>([]);
  public reservations$ = this.reservationsSubject.asObservable();
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor(private ngZone: NgZone, private auth: Auth) {
    // BehaviorSubject emite el valor actual de forma sincrona al suscribirse,
    // por lo que el primer listenReservations() se dispara aqui mismo.
    this.auth.currentUser$.subscribe(() => this.listenReservations());
  }

  private reservationsQuery() {
    const reservationsCollection = collection(db, 'reservations');
    const role = this.auth.getUserRole();
    const branchId = this.auth.getUserBranchId();
    if ((role === 'waiter' || role === 'cook') && branchId) {
      return query(reservationsCollection, where('branchId', '==', branchId));
    }
    return reservationsCollection;
  }

  private listenReservations() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }
    this.unsubscribeSnapshot = onSnapshot(this.reservationsQuery(), (snapshot) => {
      this.ngZone.run(() => {
        const reservations: Reservation[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          reservations.push({
            id: doc.id,
            branchId: data['branchId'] || '',
            tableId: data['tableId'] || '',
            customerName: data['customerName'] || '',
            customerPhone: data['customerPhone'] || '',
            customerEmail: data['customerEmail'] || '',
            date: data['date']?.toDate ? data['date'].toDate() : (data['date'] instanceof Date ? data['date'] : new Date(data['date'] || new Date())),
            time: data['time']?.toDate ? data['time'].toDate() : (data['time'] instanceof Date ? data['time'] : data['time'] || ''),
            peopleCount: data['peopleCount'] || 1,
            notes: data['notes'] || '',
            status: data['status'] || 'pending',
            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt'])
          } as Reservation);
        });
        this.reservationsSubject.next(reservations);
      });
    }, (error) => {
      console.error('[RESERVATIONS] Error en listener en tiempo real:', error);
    });
  }

  getReservations(): Observable<Reservation[]> {
    return this.reservations$;
  }

  getReservationById(id: string): Observable<Reservation | undefined> {
    return new Observable(observer => {
      const reservations = this.reservationsSubject.value;
      const reservation = reservations.find(r => r.id === id);
      observer.next(reservation);
      observer.complete();
    });
  }

  /**
   * Observa el estado de una reserva concreta en Firestore. Es el unico canal
   * por el que el cliente conoce el resultado de la llamada de confirmacion:
   * el Workflow 3 de n8n lo escribe aqui (via confirm-reservation) unos
   * segundos despues del `call_analyzed` de Retell.
   */
  watchReservationStatus(reservationId: string): Observable<string> {
    return new Observable(observer => {
      const reservationDoc = doc(db, 'reservations', reservationId);
      const unsubscribe = onSnapshot(
        reservationDoc,
        snapshot => {
          this.ngZone.run(() => {
            const status = snapshot.exists() ? snapshot.data()['status'] || 'pending' : 'pending';
            observer.next(status);
          });
        },
        error => {
          console.error('[RESERVATIONS] Error observando la reserva:', error);
          observer.error(error);
        }
      );
      return () => unsubscribe();
    });
  }

  async createReservation(reservation: Omit<Reservation, 'id' | 'createdAt'>): Promise<string> {
    try {
      console.log('ReservationsService.createReservation called with:', reservation);
      const reservationsCollection = collection(db, 'reservations');
      const dataToSave = {
        ...reservation,
        createdAt: new Date()
      };
      console.log('Data to save to Firestore:', dataToSave);
      const docRef = await addDoc(reservationsCollection, dataToSave);
      console.log('Reservation created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }
  }

  async updateReservationStatus(reservationId: string, status: Reservation['status']): Promise<void> {
    try {
      const reservationDoc = doc(db, 'reservations', reservationId);
      const updateData = {
        status
      };
      await updateDoc(reservationDoc, updateData);
      // Update local state
      const currentReservations = this.reservationsSubject.value;
      const updatedReservations = currentReservations.map(reservation =>
        reservation.id === reservationId ? { ...reservation, status } : reservation
      );
      this.reservationsSubject.next(updatedReservations);
    } catch (error) {
      console.error('Error updating reservation status:', error);
      throw error;
    }
  }

  async deleteReservation(reservationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'reservations', reservationId));
      const remaining = this.reservationsSubject.value.filter(
        reservation => reservation.id !== reservationId
      );
      this.reservationsSubject.next(remaining);
    } catch (error) {
      console.error('Error deleting reservation:', error);
      throw error;
    }
  }

  getReservationsByStatus(status: Reservation['status']): Observable<Reservation[]> {
    return new Observable(observer => {
      const reservations = this.reservationsSubject.value.filter(reservation => reservation.status === status);
      observer.next(reservations);
      observer.complete();
    });
  }

  getReservationsByDate(dateStr: string): Observable<Reservation[]> {
    return new Observable(observer => {
      const reservations = this.reservationsSubject.value.filter(reservation => {
        if (!reservation.date) return false;
        // Compare YYYY-MM-DD
        const resDate = new Date(reservation.date);
        const resDateStr = resDate.toISOString().split('T')[0];
        return resDateStr === dateStr;
      });
      observer.next(reservations);
      observer.complete();
    });
  }
}