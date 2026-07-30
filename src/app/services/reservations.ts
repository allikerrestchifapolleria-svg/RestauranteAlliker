import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Reservation } from '../models/reservation';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class ReservationsService {
  private reservationsSubject = new BehaviorSubject<Reservation[]>([]);
  public reservations$ = this.reservationsSubject.asObservable();
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor(private ngZone: NgZone) {
    this.listenReservations();
  }

  private listenReservations() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }
    const reservationsCollection = collection(db, 'reservations');
    this.unsubscribeSnapshot = onSnapshot(reservationsCollection, (snapshot) => {
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