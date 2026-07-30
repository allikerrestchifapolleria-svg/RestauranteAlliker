import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Customer } from '../models/customer';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersSubject = new BehaviorSubject<Customer[]>([]);
  public customers$ = this.customersSubject.asObservable();

  constructor(private ngZone: NgZone) {
    // Load customers from Firestore on init
    this.loadCustomersFromFirestore();
  }

  private async loadCustomersFromFirestore() {
    try {
      const customersCollection = collection(db, 'customers');
      const customersSnapshot = await getDocs(customersCollection);
      const customers: Customer[] = [];
      customersSnapshot.forEach(doc => {
        const data = doc.data();
        customers.push({
          id: doc.id,
          name: data['name'] || '',
          email: data['email'] || '',
          phone: data['phone'] || '',
          favoriteItems: Array.isArray(data['favoriteItems']) ? data['favoriteItems'] : [],
          totalOrders: data['totalOrders'] || 0,
          lastOrderAt: data['lastOrderAt']?.toDate ? data['lastOrderAt'].toDate() : null,
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date()
        } as Customer);
      });
      console.log('Loaded customers from Firestore:', customers);
      this.ngZone.run(() => this.customersSubject.next(customers));
    } catch (error) {
      console.error('Error loading customers from Firestore:', error);
    }
  }

  getCustomers(): Observable<Customer[]> {
    return this.customers$;
  }

  async registerCustomer(name: string, email: string, phone?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const currentCustomers = this.customersSubject.value;
      const existingCustomer = currentCustomers.find(c => c.email === email);

      if (existingCustomer) {
        return { success: false, message: 'El email ya está registrado' };
      }

      const customersCollection = collection(db, 'customers');
      const dataToSave = {
        name: name,
        email: email || '',
        phone: phone || '',
        favoriteItems: [],
        totalOrders: 0,
        lastOrderAt: null,
        createdAt: new Date()
      };
      console.log('Registering customer with data:', dataToSave);
      const docRef = await addDoc(customersCollection, dataToSave);

      // Reload customers to include the new one
      await this.loadCustomersFromFirestore();
      return { success: true };
    } catch (error) {
      console.error('Error registering customer:', error);
      return { success: false, message: 'Error de conexión' };
    }
  }

  getCustomerById(id: string): Observable<Customer | undefined> {
    return new Observable(observer => {
      const customers = this.customersSubject.value;
      const customer = customers.find(c => c.id === id);
      observer.next(customer);
      observer.complete();
    });
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    try {
      const customerDoc = doc(db, 'customers', id);
      const dataToUpdate = {
        ...updates,
        // Ensure timestamps are properly handled
        lastOrderAt: updates.lastOrderAt || null
      };
      await updateDoc(customerDoc, dataToUpdate);
      // Update local state
      const currentCustomers = this.customersSubject.value;
      const updatedCustomers = currentCustomers.map(customer =>
        customer.id === id ? { ...customer, ...updates } : customer
      );
      this.customersSubject.next(updatedCustomers);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      const customerDoc = doc(db, 'customers', id);
      await deleteDoc(customerDoc);
      // Update local state
      const currentCustomers = this.customersSubject.value;
      const filteredCustomers = currentCustomers.filter(customer => customer.id !== id);
      this.customersSubject.next(filteredCustomers);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }
}