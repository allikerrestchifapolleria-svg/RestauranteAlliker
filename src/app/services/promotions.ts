import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Promotion } from '../models/promotion';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class PromotionsService {
  private promotionsSubject = new BehaviorSubject<Promotion[]>([]);
  public promotions$ = this.promotionsSubject.asObservable();

  constructor(private ngZone: NgZone) {
    // Load promotions from Firestore on init
    this.loadPromotionsFromFirestore();
  }

  private async loadPromotionsFromFirestore() {
    try {
      const promotionsCollection = collection(db, 'promotions');
      const promotionsSnapshot = await getDocs(promotionsCollection);
      const promotions: Promotion[] = [];
      promotionsSnapshot.forEach(doc => {
        const data = doc.data();
        promotions.push({
          id: doc.id,
          active: data['active'] || false,
          appliesTo: data['appliesTo'] || {},
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
          description: data['description'] || '',
          discountPercentage: data['discountPercentage'] || 0,
          image: data['image'] || '',
          title: data['title'] || '',
          type: data['type'] || '',
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt']),
          validDays: Array.isArray(data['validDays']) ? data['validDays'] : [],
          validHours: data['validHours'] || { start: '12', end: '22' }
        } as Promotion);
      });
      console.log('Loaded promotions from Firestore:', promotions);
      this.ngZone.run(() => this.promotionsSubject.next(promotions));
    } catch (error) {
      console.error('Error loading promotions from Firestore:', error);
    }
  }

  getPromotions(): Observable<Promotion[]> {
    return this.promotions$;
  }

  getActivePromotions(): Observable<Promotion[]> {
    return new Observable(observer => {
      const promotions = this.promotionsSubject.value.filter(promo => promo.active);
      observer.next(promotions);
      observer.complete();
    });
  }

  getPromotionById(id: string): Observable<Promotion | undefined> {
    return new Observable(observer => {
      const promotions = this.promotionsSubject.value;
      const promotion = promotions.find(p => p.id === id);
      observer.next(promotion);
      observer.complete();
    });
  }

  async createPromotion(promotion: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      console.log('PromotionsService.createPromotion called with:', promotion);
      const promotionsCollection = collection(db, 'promotions');
      const dataToSave = {
        ...promotion,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      console.log('Data to save to Firestore:', dataToSave);
      const docRef = await addDoc(promotionsCollection, dataToSave);
      console.log('Promotion created with ID:', docRef.id);
      // Reload promotions to include the new one
      await this.loadPromotionsFromFirestore();
      console.log('Promotions reloaded from Firestore after create');
    } catch (error) {
      console.error('Error creating promotion:', error);
      throw error;
    }
  }

  async updatePromotion(id: string, updates: Partial<Promotion>): Promise<void> {
    try {
      const promotionDoc = doc(db, 'promotions', id);
      const dataToUpdate = {
        ...updates,
        updatedAt: new Date()
      };
      await updateDoc(promotionDoc, dataToUpdate);
      // Update local state
      const currentPromotions = this.promotionsSubject.value;
      const updatedPromotions = currentPromotions.map(promotion =>
        promotion.id === id ? { ...promotion, ...updates, updatedAt: new Date() } : promotion
      );
      this.promotionsSubject.next(updatedPromotions);
    } catch (error) {
      console.error('Error updating promotion:', error);
      throw error;
    }
  }

  async deletePromotion(id: string): Promise<void> {
    try {
      const promotionDoc = doc(db, 'promotions', id);
      await deleteDoc(promotionDoc);
      // Update local state
      const currentPromotions = this.promotionsSubject.value;
      const filteredPromotions = currentPromotions.filter(promotion => promotion.id !== id);
      this.promotionsSubject.next(filteredPromotions);
    } catch (error) {
      console.error('Error deleting promotion:', error);
      throw error;
    }
  }

  async togglePromotionStatus(id: string): Promise<void> {
    try {
      const currentPromotions = this.promotionsSubject.value;
      const promotion = currentPromotions.find(p => p.id === id);
      if (promotion) {
        await this.updatePromotion(id, { active: !promotion.active });
      }
    } catch (error) {
      console.error('Error toggling promotion status:', error);
      throw error;
    }
  }
}