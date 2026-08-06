import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { BranchService } from '../../../services/branch';
import { Branch } from '../../../models/branch';

@Component({
  selector: 'app-branch-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-management.html',
  styleUrl: './branch-management.css',
})
export class BranchManagement implements OnInit {
  branches$: Observable<Branch[]> = new Observable<Branch[]>();
  searchTerm: string = '';
  searchTerm$ = new BehaviorSubject<string>('');
  filteredBranches$: Observable<Branch[]>;
  showAddForm: boolean = false;
  editingBranch: Branch | null = null;
  nameError: string = '';
  phoneError: string = '';
  private currentBranches: Branch[] = [];

  // Form data
  newBranch: Partial<Branch> = {
    branchId: '',
    name: '',
    address: '',
    phone: '',
    openingHours: {
      lunes: { open: '12:00', close: '22:00' },
      martes: { open: '12:00', close: '22:00' },
      miercoles: { open: '12:00', close: '22:00' },
      jueves: { open: '12:00', close: '22:00' },
      viernes: { open: '12:00', close: '22:00' },
      sabado: { open: '12:00', close: '22:00' },
      domingo: { open: '12:00', close: '22:00' }
    },
    status: 'open'
  };

  constructor(private branchService: BranchService) {
    this.branches$ = this.branchService.getBranches();
    this.filteredBranches$ = combineLatest([this.branches$, this.searchTerm$]).pipe(
      map(([branches, term]) =>
        branches.filter(branch =>
          branch.name.toLowerCase().includes(term.toLowerCase()) ||
          branch.address.toLowerCase().includes(term.toLowerCase()) ||
          branch.phone.toLowerCase().includes(term.toLowerCase())
        )
      )
    );
  }

  ngOnInit() {
    // Subscribe to keep currentBranches updated
    this.branches$.subscribe(branches => {
      this.currentBranches = branches;
    });
  }


  onSearch() {
    // Emit the current search term to trigger filtering
    this.searchTerm$.next(this.searchTerm);
  }

  addNewBranch() {
    this.showAddForm = true;
    this.editingBranch = null;
    this.resetForm();
    this.onRestaurantChange();
  }

  editBranch(branch: Branch) {
    this.showAddForm = true;
    this.editingBranch = branch;
    this.newBranch = {
      ...branch,
      openingHours: { ...branch.openingHours } // Deep copy to avoid reference issues
    };
  }

  async saveBranch() {
    try {
      this.nameError = '';
      this.phoneError = '';

      if (!this.newBranch.name || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.newBranch.name)) {
        this.nameError = 'Solo se permiten letras y espacios';
        return;
      }
      if (this.newBranch.phone && !/^[0-9]{1,9}$/.test(this.newBranch.phone)) {
        this.phoneError = 'Solo se permiten números (máximo 9 dígitos)';
        return;
      }

      if (this.editingBranch) {
        // Update existing branch
        console.log('Updating branch:', this.newBranch);
        await this.branchService.updateBranch(this.editingBranch.id, this.newBranch);
        this.cancelEdit();
      } else {
        // Add new branch
        const branchToAdd: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'> = {
          branchId: this.newBranch.branchId || '',
          name: this.newBranch.name || '',
          address: this.newBranch.address || '',
          phone: this.newBranch.phone || '',
          openingHours: this.newBranch.openingHours || {},
          status: this.newBranch.status || 'open'
        };
        console.log('Adding branch:', branchToAdd);
        await this.branchService.createBranch(branchToAdd);
        this.cancelEdit();
      }
    } catch (error) {
      console.error('Error saving branch:', error);
      alert('Error al guardar la sucursal. Por favor, inténtalo de nuevo.');
    }
  }

  async deleteBranch(branch: Branch) {
    if (confirm(`¿Estás seguro de que quieres eliminar la sucursal "${branch.name}"?`)) {
      try {
        await this.branchService.deleteBranch(branch.id);
        console.log('Branch deleted');
      } catch (error) {
        console.error('Error deleting branch:', error);
        alert('Error al eliminar la sucursal. Por favor, inténtalo de nuevo.');
      }
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingBranch = null;
    this.resetForm();
  }

  private resetForm() {
    this.newBranch = {
      branchId: '',
      name: '',
      address: '',
      phone: '',
      openingHours: {
        lunes: { open: '12:00', close: '22:00' },
        martes: { open: '12:00', close: '22:00' },
        miercoles: { open: '12:00', close: '22:00' },
        jueves: { open: '12:00', close: '22:00' },
        viernes: { open: '12:00', close: '22:00' },
        sabado: { open: '12:00', close: '22:00' },
        domingo: { open: '12:00', close: '22:00' }
      },
      status: 'open'
    };
  }

  getOpeningHour(day: string, type: 'open' | 'close'): string {
    return this.newBranch.openingHours?.[day]?.[type] || (type === 'open' ? '12:00' : '22:00');
  }

  updateOpeningHour(day: string, type: 'open' | 'close', value: string) {
    if (!this.newBranch.openingHours) {
      this.newBranch.openingHours = {};
    }
    if (!this.newBranch.openingHours[day]) {
      this.newBranch.openingHours[day] = { open: '12:00', close: '22:00' };
    }
    this.newBranch.openingHours[day][type] = value;
  }

  onNameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newBranch.name = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    if (this.newBranch.name && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.newBranch.name)) {
      this.nameError = 'Solo se permiten letras y espacios';
    } else {
      this.nameError = '';
    }
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newBranch.phone = input.value.replace(/\D/g, '').slice(0, 9);
    if (this.newBranch.phone && !/^[0-9]{1,9}$/.test(this.newBranch.phone)) {
      this.phoneError = 'Solo se permiten números (máximo 9 dígitos)';
    } else {
      this.phoneError = '';
    }
  }

  onRestaurantChange() {
    const branchesForRestaurant = this.currentBranches;

    const numbers = branchesForRestaurant
      .map((branch: Branch) => branch.branchId)
      .filter((id: string) => id.startsWith('SUCC'))
      .map((id: string) => parseInt(id.substring(4), 10))
      .filter((num: number) => !isNaN(num));

    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNumber = maxNumber + 1;

    this.newBranch.branchId = `SUCC${nextNumber.toString().padStart(3, '0')}`;
  }
}