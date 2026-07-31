import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MenuItem } from '../models/menu-item';
import { MenuCategory } from '../models/menu-category';
import { MenuCategoryService } from './menu-category';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  public menuItemsSubject = new BehaviorSubject<MenuItem[]>([]);
  public menuItems$ = this.menuItemsSubject.asObservable();
  private loaded = false;

  constructor(private categoryService: MenuCategoryService, private ngZone: NgZone) {
    // Load will be triggered when getMenuItems() is called
  }

  getMenuCategories(): Observable<MenuCategory[]> {
    return this.categoryService.getCategories();
  }

  private async loadMenuItemsFromFirestore() {
    try {
      console.log('🔄 Cargando items del menú desde Firestore...');
      const menuItemsCollection = collection(db, 'menu_items');
      const menuItemsSnapshot = await getDocs(menuItemsCollection);
      console.log(`📊 Encontrados ${menuItemsSnapshot.size} items en la colección 'menu_items'`);

      const menuItems: MenuItem[] = [];
      menuItemsSnapshot.forEach(doc => {
        const data = doc.data();
        menuItems.push({
          id: doc.id,
          categoryId: data['categoryId'] || '',
          name: data['name'] || '',
          description: data['description'] || '',
          price: data['price'] || 0,
          image: data['image'] || '',
          tags: Array.isArray(data['tags']) ? data['tags'] : [],
          variants: Array.isArray(data['variants']) ? data['variants'] : [],
          modifiers: Array.isArray(data['modifiers']) ? data['modifiers'] : [],
          isAvailable: data['isAvailable'] ?? true,
          servicePeriodIds: Array.isArray(data['servicePeriodIds']) ? data['servicePeriodIds'] : [],
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt'])
        } as MenuItem);
      });
      console.log('✅ Items del menú cargados:', menuItems.length, 'items');
      this.ngZone.run(() => {
        this.menuItemsSubject.next(menuItems);
      });
    } catch (error) {
      console.error('❌ Error cargando items del menú:', error);
      // Emit empty array on error to prevent hanging
      this.ngZone.run(() => {
        this.menuItemsSubject.next([]);
      });
    }
  }

  getMenuItems(): Observable<MenuItem[]> {
    if (!this.loaded) {
      this.loaded = true;
      this.loadMenuItemsFromFirestore();
    }
    return this.menuItems$;
  }

  async addMenuItem(item: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('MenuService.addMenuItem called with:', item);
      const menuItemsCollection = collection(db, 'menu_items');
      const dataToSave = {
        categoryId: item.categoryId,
        createdAt: new Date(),
        description: item.description,
        image: item.image,
        isAvailable: item.isAvailable,
        modifiers: item.modifiers || [],
        name: item.name,
        price: item.price,
        servicePeriodIds: item.servicePeriodIds || [],
        tags: item.tags || [],
        updatedAt: new Date(),
        variants: item.variants || []
      };
      console.log('Data to save to Firestore:', dataToSave);
      const docRef = await addDoc(menuItemsCollection, dataToSave);
      console.log('Menu item created with ID:', docRef.id);
      // Reload menu items to include the new one
      await this.loadMenuItemsFromFirestore();
      console.log('Menu items reloaded from Firestore after create');
      return docRef.id;
    } catch (error) {
      console.error('Error adding menu item:', error);
      throw error;
    }
  }

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void> {
    try {
      const itemDoc = doc(db, 'menu_items', id);
      const dataToUpdate = {
        ...updates,
        updatedAt: new Date()
      };
      // Ensure arrays are properly handled
      if (updates.tags !== undefined) dataToUpdate.tags = updates.tags;
      if (updates.variants !== undefined) dataToUpdate.variants = updates.variants;
      if (updates.modifiers !== undefined) dataToUpdate.modifiers = updates.modifiers;

      await updateDoc(itemDoc, dataToUpdate);
      // Update local state
      const currentItems = this.menuItemsSubject.value;
      const updatedItems = currentItems.map(item =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
      );
      this.ngZone.run(() => {
        this.menuItemsSubject.next(updatedItems);
      });
    } catch (error) {
      console.error('Error updating menu item:', error);
      throw error;
    }
  }

  async deleteMenuItem(id: string): Promise<void> {
    try {
      const itemDoc = doc(db, 'menu_items', id);
      await deleteDoc(itemDoc);
      // Update local state
      const currentItems = this.menuItemsSubject.value;
      const filteredItems = currentItems.filter(item => item.id !== id);
      this.ngZone.run(() => {
        this.menuItemsSubject.next(filteredItems);
      });
    } catch (error) {
      console.error('Error deleting menu item:', error);
      throw error;
    }
  }

  getMenuItemsByCategory(categoryId: string): Observable<MenuItem[]> {
    return new Observable(observer => {
      const items = this.menuItemsSubject.value.filter(item => item.categoryId === categoryId);
      observer.next(items);
      observer.complete();
    });
  }
}
