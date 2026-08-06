import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import {
  ServicePeriod,
  RestaurantSchedule,
  DEFAULT_RESTAURANT_SCHEDULE,
} from '../models/service-period';
import { MenuItem } from '../models/menu-item';
import { MenuCategory } from '../models/menu-category';

const SCHEDULE_DOC_ID = '_schedule';

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(part => parseInt(part, 10) || 0);
  return hours * 60 + minutes;
}

function toDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable({
  providedIn: 'root',
})
export class MenuAvailabilityService {
  private periodsSubject = new BehaviorSubject<ServicePeriod[]>([]);
  public periods$ = this.periodsSubject.asObservable();

  private scheduleSubject = new BehaviorSubject<RestaurantSchedule>({
    ...DEFAULT_RESTAURANT_SCHEDULE,
    closedDays: [...DEFAULT_RESTAURANT_SCHEDULE.closedDays],
  });
  public schedule$ = this.scheduleSubject.asObservable();

  private nowSubject = new BehaviorSubject<Date>(new Date());
  public now$ = this.nowSubject.asObservable();
  private clockStarted = false;

  private periodsLoaded = false;
  private scheduleLoaded = false;

  constructor(private ngZone: NgZone) {}

  startClock() {
    if (this.clockStarted) {
      return;
    }
    this.clockStarted = true;
    interval(60_000).subscribe(() => {
      this.ngZone.run(() => this.nowSubject.next(new Date()));
    });
  }

  // ============================================================
  // Franjas de servicio (service_periods)
  // ============================================================

  getPeriods(): Observable<ServicePeriod[]> {
    if (!this.periodsLoaded) {
      this.periodsLoaded = true;
      this.loadPeriodsFromFirestore();
    }
    return this.periods$;
  }

  private async loadPeriodsFromFirestore() {
    try {
      const periodsCollection = collection(db, 'service_periods');
      const snapshot = await getDocs(periodsCollection);
      const periods: ServicePeriod[] = [];
      snapshot.forEach(doc => {
        if (doc.id === SCHEDULE_DOC_ID) {
          return;
        }
        const data = doc.data();
        periods.push({
          id: doc.id,
          name: data['name'] || '',
          days: Array.isArray(data['days']) ? data['days'].map(Number) : [],
          startTime: data['startTime'] || '00:00',
          endTime: data['endTime'] || '23:59',
          icon: data['icon'] || 'fas fa-clock',
          order: data['order'] || 0,
          active: data['active'] ?? true,
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt']),
        } as ServicePeriod);
      });
      periods.sort((a, b) => a.order - b.order);
      console.log('✅ Franjas de servicio cargadas:', periods.length);
      this.ngZone.run(() => this.periodsSubject.next(periods));
    } catch (error) {
      console.error('❌ Error cargando franjas de servicio:', error);
      this.ngZone.run(() => this.periodsSubject.next([]));
    }
  }

  async addPeriod(period: Omit<ServicePeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const periodsCollection = collection(db, 'service_periods');
      const dataToSave = {
        name: period.name,
        days: period.days || [],
        startTime: period.startTime,
        endTime: period.endTime,
        icon: period.icon || 'fas fa-clock',
        order: period.order || 0,
        active: period.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const docRef = await addDoc(periodsCollection, dataToSave);
      console.log('Franja creada con ID:', docRef.id);
      await this.loadPeriodsFromFirestore();
      return docRef.id;
    } catch (error) {
      console.error('Error creando franja:', error);
      throw error;
    }
  }

  async updatePeriod(id: string, updates: Partial<ServicePeriod>): Promise<void> {
    try {
      const periodDoc = doc(db, 'service_periods', id);
      const dataToUpdate = {
        ...updates,
        updatedAt: new Date(),
      };
      await updateDoc(periodDoc, dataToUpdate);
      const current = this.periodsSubject.value;
      const updated = current.map(period =>
        period.id === id ? { ...period, ...updates, updatedAt: new Date() } : period
      );
      this.ngZone.run(() => this.periodsSubject.next(updated));
    } catch (error) {
      console.error('Error actualizando franja:', error);
      throw error;
    }
  }

  async deletePeriod(id: string): Promise<void> {
    try {
      const periodDoc = doc(db, 'service_periods', id);
      await deleteDoc(periodDoc);
      const current = this.periodsSubject.value;
      const filtered = current.filter(period => period.id !== id);
      this.ngZone.run(() => this.periodsSubject.next(filtered));
    } catch (error) {
      console.error('Error eliminando franja:', error);
      throw error;
    }
  }

  // ============================================================
  // Horario del local (service_periods/_schedule)
  // ============================================================

  getSchedule(): Observable<RestaurantSchedule> {
    if (!this.scheduleLoaded) {
      this.scheduleLoaded = true;
      this.loadScheduleFromFirestore();
    }
    return this.schedule$;
  }

  private async loadScheduleFromFirestore() {
    try {
      const scheduleDoc = doc(db, 'service_periods', SCHEDULE_DOC_ID);
      const snapshot = await getDoc(scheduleDoc);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const schedule: RestaurantSchedule = {
          closedDays: Array.isArray(data['closedDays']) ? data['closedDays'].map(Number) : [],
          closedDates: Array.isArray(data['closedDates']) ? data['closedDates'] : [],
          closedMessage: data['closedMessage'] || DEFAULT_RESTAURANT_SCHEDULE.closedMessage,
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : undefined,
        };
        this.ngZone.run(() => this.scheduleSubject.next(schedule));
      } else {
        await this.updateSchedule(this.scheduleSubject.value);
      }
    } catch (error) {
      console.error('❌ Error cargando horario del local:', error);
    }
  }

  async updateSchedule(updates: Partial<RestaurantSchedule>): Promise<void> {
    try {
      const scheduleDoc = doc(db, 'service_periods', SCHEDULE_DOC_ID);
      const next = {
        ...this.scheduleSubject.value,
        ...updates,
        updatedAt: new Date(),
      };
      await setDoc(scheduleDoc, next, { merge: true });
      this.ngZone.run(() => this.scheduleSubject.next(next));
    } catch (error) {
      console.error('Error guardando horario del local:', error);
      throw error;
    }
  }

  // ============================================================
  // Lógica de disponibilidad
  // ============================================================

  isRestaurantOpen(now: Date = new Date()): boolean {
    const schedule = this.scheduleSubject.value;
    const todayKey = toDateKey(now);
    if (schedule.closedDates.includes(todayKey)) {
      return false;
    }
    const day = now.getDay();
    return !schedule.closedDays.includes(day);
  }

  isPeriodActive(period: ServicePeriod, now: Date = new Date()): boolean {
    if (!period.active) {
      return false;
    }
    const day = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = toMinutes(period.startTime);
    const endMin = toMinutes(period.endTime);

    if (startMin <= endMin) {
      return period.days.includes(day) && nowMin >= startMin && nowMin < endMin;
    }

    if (nowMin >= startMin) {
      return period.days.includes(day);
    }
    if (nowMin < endMin) {
      const previousDay = (day + 6) % 7;
      return period.days.includes(previousDay);
    }
    return false;
  }

  getPeriodIdsForItem(item: MenuItem, category?: MenuCategory | null): string[] {
    if (item.servicePeriodIds && item.servicePeriodIds.length > 0) {
      return item.servicePeriodIds;
    }
    if (category && category.defaultServicePeriodIds && category.defaultServicePeriodIds.length > 0) {
      return category.defaultServicePeriodIds;
    }
    return [];
  }

  getPeriodsForItem(item: MenuItem, category?: MenuCategory | null): ServicePeriod[] {
    const ids = this.getPeriodIdsForItem(item, category);
    if (ids.length === 0) {
      return [];
    }
    return this.periodsSubject.value.filter(period => ids.includes(period.id) && period.active);
  }

  getItemPeriodLabel(item: MenuItem, category?: MenuCategory | null): string {
    const periods = this.getPeriodsForItem(item, category);
    if (periods.length === 0) {
      return '';
    }
    return periods
      .map(period => `${period.name} ${period.startTime}-${period.endTime}`)
      .join(' · ');
  }

  isItemAvailable(item: MenuItem, category?: MenuCategory | null, now: Date = new Date()): boolean {
    if (!item.isAvailable) {
      return false;
    }
    if (!this.isRestaurantOpen(now)) {
      return false;
    }
    const periodIds = this.getPeriodIdsForItem(item, category);
    if (periodIds.length === 0) {
      return true;
    }
    const periods = this.periodsSubject.value.filter(
      period => periodIds.includes(period.id) && period.active
    );
    if (periods.length === 0) {
      return false;
    }
    return periods.some(period => this.isPeriodActive(period, now));
  }

}
