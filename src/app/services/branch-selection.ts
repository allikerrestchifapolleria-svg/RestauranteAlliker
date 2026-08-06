import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Branch } from '../models/branch';

@Injectable({
  providedIn: 'root'
})
export class BranchSelectionService {
  private selectedBranchIdSubject = new BehaviorSubject<string>(
    localStorage.getItem('selectedBranchId') || ''
  );
  public selectedBranchId$ = this.selectedBranchIdSubject.asObservable();
  private branches: Branch[] = [];

  selectBranch(branchId: string): void {
    localStorage.setItem('selectedBranchId', branchId);
    this.selectedBranchIdSubject.next(branchId);
  }

  getSelectedBranchId(): string {
    return this.selectedBranchIdSubject.value;
  }

  getSelectedBranchName(): string {
    const id = this.getSelectedBranchId();
    const branch = this.branches.find(b => b.id === id);
    return branch?.name || 'Sin sucursal';
  }

  setBranches(branches: Branch[]): void {
    this.branches = branches;
  }

  initializeFromUserBranch(userBranchId: string | null): void {
    const stored = localStorage.getItem('selectedBranchId');
    if (stored) return;

    if (userBranchId) {
      this.selectBranch(userBranchId);
    } else if (this.branches.length > 0) {
      this.selectBranch(this.branches[0].id);
    }
  }
}
