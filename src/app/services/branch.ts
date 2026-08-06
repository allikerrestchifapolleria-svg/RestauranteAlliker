import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Branch } from '../models/branch';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private branchesSubject = new BehaviorSubject<Branch[]>([]);
  public branches$ = this.branchesSubject.asObservable();

  constructor(private ngZone: NgZone) {
    // Load branches from Firestore on init
    this.loadBranchesFromFirestore();
  }

  private async loadBranchesFromFirestore() {
    try {
      const branchesCollection = collection(db, 'branches');
      const branchesSnapshot = await getDocs(branchesCollection);
      const branches: Branch[] = [];
      branchesSnapshot.forEach(doc => {
        const data = doc.data();
        branches.push({
          id: doc.id,
          branchId: doc.id, // Use document ID as branchId for consistency with tables
          name: data['name'] || '',
          address: data['address'] || '',
          phone: data['phone'] || '',
          openingHours: data['openingHours'] || {},
          status: data['status'] || 'open',
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt'])
        } as Branch);
      });
      console.log('Loaded branches from Firestore:', branches);
      // Deferred so this emission always lands in its own change-detection tick.
      // Without this, when it lands on a microtask that's already mid-flush
      // alongside other Firestore reads (e.g. notification types), it can
      // update `branches` in between a component's check and Angular's
      // dev-mode re-check of the same view, throwing NG0100.
      setTimeout(() => this.ngZone.run(() => this.branchesSubject.next(branches)));
    } catch (error) {
      console.error('Error loading branches from Firestore:', error);
    }
  }

  getBranches(): Observable<Branch[]> {
    return this.branches$;
  }

  async createBranch(branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      console.log('BranchService.createBranch called with:', branch);
      const branchesCollection = collection(db, 'branches');
      const dataToSave = {
        ...branch,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      console.log('Data to save to Firestore:', dataToSave);
      const docRef = await addDoc(branchesCollection, dataToSave);
      console.log('Branch created with ID:', docRef.id);
      // Reload branches to include the new one
      await this.loadBranchesFromFirestore();
      console.log('Branches reloaded from Firestore after create');
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  }

  getBranchById(id: string): Observable<Branch | undefined> {
    return new Observable(observer => {
      const branches = this.branchesSubject.value;
      const branch = branches.find(b => b.id === id);
      observer.next(branch);
      observer.complete();
    });
  }

  async updateBranch(id: string, updates: Partial<Branch>): Promise<void> {
    try {
      const branchDoc = doc(db, 'branches', id);
      const dataToUpdate = {
        ...updates,
        updatedAt: new Date()
      };
      await updateDoc(branchDoc, dataToUpdate);
      // Update local state
      const currentBranches = this.branchesSubject.value;
      const updatedBranches = currentBranches.map(branch =>
        branch.id === id ? { ...branch, ...updates, updatedAt: new Date() } : branch
      );
      this.branchesSubject.next(updatedBranches);
    } catch (error) {
      console.error('Error updating branch:', error);
      throw error;
    }
  }

  async deleteBranch(id: string): Promise<void> {
    try {
      const branchDoc = doc(db, 'branches', id);
      await deleteDoc(branchDoc);
      // Update local state
      const currentBranches = this.branchesSubject.value;
      const filteredBranches = currentBranches.filter(branch => branch.id !== id);
      this.branchesSubject.next(filteredBranches);
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  }
}