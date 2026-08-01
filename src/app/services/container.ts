import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TakeoutContainer } from '../models/container';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class ContainerService {
  private containersSubject = new BehaviorSubject<TakeoutContainer[]>([]);
  public containers$ = this.containersSubject.asObservable();
  private loaded = false;

  constructor(private ngZone: NgZone) {}

  private async loadContainersFromFirestore() {
    try {
      const containersCollection = collection(db, 'takeout_containers');
      const snapshot = await getDocs(containersCollection);
      const containers: TakeoutContainer[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        containers.push({
          id: docSnap.id,
          name: data['name'] || '',
          price: data['price'] || 0,
          description: data['description'] || '',
          isDefault: data['isDefault'] ?? false,
          active: data['active'] ?? true,
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(),
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date()
        });
      });
      containers.sort((a, b) => a.price - b.price);
      console.log('[CONTAINERS] Recipientes cargados:', containers.length);
      this.ngZone.run(() => this.containersSubject.next(containers));
    } catch (error) {
      console.error('[CONTAINERS] Error cargando recipientes:', error);
      this.ngZone.run(() => this.containersSubject.next([]));
    }
  }

  getContainers(): Observable<TakeoutContainer[]> {
    if (!this.loaded) {
      this.loaded = true;
      this.loadContainersFromFirestore();
    }
    return this.containers$;
  }

  getActiveContainers(): TakeoutContainer[] {
    return this.containersSubject.value.filter(c => c.active);
  }

  getContainerById(id: string): TakeoutContainer | undefined {
    return this.containersSubject.value.find(c => c.id === id);
  }

  async createContainer(container: Omit<TakeoutContainer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const containersCollection = collection(db, 'takeout_containers');
    const docRef = await addDoc(containersCollection, {
      name: container.name,
      price: container.price,
      description: container.description || '',
      isDefault: container.isDefault ?? false,
      active: container.active ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await this.loadContainersFromFirestore();
    return docRef.id;
  }

  async updateContainer(id: string, updates: Partial<TakeoutContainer>): Promise<void> {
    const containerDoc = doc(db, 'takeout_containers', id);
    await updateDoc(containerDoc, { ...updates, updatedAt: new Date() } as any);
    await this.loadContainersFromFirestore();
  }

  async deleteContainer(id: string): Promise<void> {
    const containerDoc = doc(db, 'takeout_containers', id);
    await deleteDoc(containerDoc);
    const remaining = this.containersSubject.value.filter(c => c.id !== id);
    this.ngZone.run(() => this.containersSubject.next(remaining));
  }
}
