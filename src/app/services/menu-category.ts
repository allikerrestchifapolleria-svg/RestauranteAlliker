import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MenuCategory } from '../models/menu-category';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class MenuCategoryService {
  private categoriesSubject = new BehaviorSubject<MenuCategory[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  constructor(private ngZone: NgZone) {
    // Load categories from Firestore on init
    this.loadCategoriesFromFirestore();
  }

  private async loadCategoriesFromFirestore() {
    try {
      const categoriesCollection = collection(db, 'menu_categories');
      const categoriesSnapshot = await getDocs(categoriesCollection);
      const categories: MenuCategory[] = [];
      categoriesSnapshot.forEach(doc => {
        const data = doc.data();
        categories.push({
          id: doc.id,
          name: data['name'] || '',
          active: data['active'] ?? true,
          defaultServicePeriodIds: Array.isArray(data['defaultServicePeriodIds']) ? data['defaultServicePeriodIds'] : [],
          createdAt: new Date(), // Default since not stored
          updatedAt: new Date()  // Default since not stored
        } as MenuCategory);
      });
      console.log('Loaded categories from Firestore:', categories);
      this.ngZone.run(() => this.categoriesSubject.next(categories));
    } catch (error) {
      console.error('Error loading categories from Firestore:', error);
    }
  }

  getCategories(): Observable<MenuCategory[]> {
    return this.categories$;
  }

  async createCategory(category: Omit<MenuCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      console.log('MenuCategoryService.createCategory called with:', category);
      const categoriesCollection = collection(db, 'menu_categories');
      const dataToSave = {
        active: category.active,
        name: category.name,
        defaultServicePeriodIds: category.defaultServicePeriodIds || []
      };
      console.log('Data to save to Firestore:', dataToSave);
      console.log('Attempting to save to collection: menu_categories');
      const docRef = await addDoc(categoriesCollection, dataToSave);
      console.log('Category created with ID:', docRef.id);
      // Reload categories to include the new one
      await this.loadCategoriesFromFirestore();
      console.log('Categories reloaded from Firestore after create');
    } catch (error) {
      console.error('Error creating category in service:', error);
      throw error;
    }
  }

  getCategoryById(id: string): Observable<MenuCategory | undefined> {
    return new Observable(observer => {
      const categories = this.categoriesSubject.value;
      const category = categories.find(c => c.id === id);
      observer.next(category);
      observer.complete();
    });
  }

  async updateCategory(id: string, updates: Partial<MenuCategory>): Promise<void> {
    try {
      const categoryDoc = doc(db, 'menu_categories', id);
      const updateData: Record<string, unknown> = {
        active: updates.active,
        name: updates.name
      };
      if (updates.defaultServicePeriodIds !== undefined) {
        updateData['defaultServicePeriodIds'] = updates.defaultServicePeriodIds;
      }
      await updateDoc(categoryDoc, updateData);
      // Update local state
      const currentCategories = this.categoriesSubject.value;
      const updatedCategories = currentCategories.map(category =>
        category.id === id ? { ...category, ...updates } : category
      );
      this.categoriesSubject.next(updatedCategories);
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const categoryDoc = doc(db, 'menu_categories', id);
      await deleteDoc(categoryDoc);
      // Update local state
      const currentCategories = this.categoriesSubject.value;
      const filteredCategories = currentCategories.filter(category => category.id !== id);
      this.categoriesSubject.next(filteredCategories);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }
}