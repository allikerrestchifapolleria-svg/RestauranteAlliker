import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { TableService } from '../../../services/table';
import { BranchService } from '../../../services/branch';
import { TableMergeService } from '../../../services/table-merge';
import { Table } from '../../../models/table';
import { Branch } from '../../../models/branch';

@Component({
  selector: 'app-table-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-management.html',
  styleUrl: './table-management.css',
})
export class TableManagement {

  searchTerm = '';
  private searchSubject = new BehaviorSubject<string>('');

  showAddForm = false;
  editingTable: Table | null = null;

  showMergeMode = false;
  selectedForMerge: Set<string> = new Set();
  permanentFamilies$: Observable<(Table & { _children: Table[]; _displayName: string })[]>;

  filteredTables$: Observable<Table[]>;
  branches$: BehaviorSubject<Branch[]> = new BehaviorSubject<Branch[]>([]);
  branches: Branch[] = [];

  newTable: Partial<Table> = {
    branchId: '',
    number: 0,
    status: 'free',
    capacity: 4
  };

  constructor(
    private tableService: TableService,
    private branchService: BranchService,
    private tableMergeService: TableMergeService
  ) {
    this.branchService.getBranches().subscribe(allBranches => {
      this.branches$.next(allBranches);
      this.branches = allBranches;
    });

    this.filteredTables$ = combineLatest([
      this.tableService.getTables(),
      this.searchSubject.asObservable()
    ]).pipe(
      map(([tables, term]) => {
        const search = term.toLowerCase();
        return tables.filter(t => {
          if (t.familyGroupId && t.permanentFamily) {
            return false;
          }
          return t.name.toLowerCase().includes(search) ||
            t.number.toString().includes(search);
        });
      })
    );

    this.permanentFamilies$ = this.tableService.getTables().pipe(
      map(tables => {
        const groups = new Map<string, Table[]>();
        tables.forEach(t => {
          if (t.familyGroupId && t.permanentFamily) {
            const list = groups.get(t.familyGroupId) || [];
            list.push(t);
            groups.set(t.familyGroupId, list);
          }
        });

        return Array.from(groups.entries()).map(([groupId, children]) => {
          const names = children.map(c => c.name).join(' + ');
          const capacity = children.reduce((sum, c) => sum + (c.capacity || 4), 0);
          return {
            ...children[0],
            number: 0,
            name: 'Mesa Familiar',
            capacity,
            permanentFamily: true,
            _children: children,
            _displayName: 'Mesa Familiar: ' + names
          } as Table & { _children: Table[]; _displayName: string };
        });
      })
    );
  }

  onSearch() {
    this.searchSubject.next(this.searchTerm);
  }

  addNewTable() {
    this.showAddForm = true;
    this.editingTable = null;
    this.resetForm();
  }

  editTable(table: Table) {
    this.showAddForm = true;
    this.editingTable = table;
    this.newTable = { ...table };
  }

  async saveTable() {
    if (!this.newTable.branchId || !this.newTable.number) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    try {
      const name = `Mesa ${this.newTable.number}`;
      if (this.editingTable) {
        await this.tableService.updateTable(this.editingTable.id, {
          ...this.newTable,
          name,
          currentOrderId: this.editingTable.currentOrderId
        });
      } else {
        await this.tableService.createTable({
          branchId: this.newTable.branchId,
          name,
          number: this.newTable.number,
          status: this.newTable.status || 'free',
          capacity: this.newTable.capacity || 4,
          currentOrderId: null
        });
      }
      this.cancelEdit();
    } catch (error) {
      console.error(error);
      alert('Error al guardar la mesa');
    }
  }

  async deleteTable(table: Table) {
    if (confirm(`¿Eliminar la mesa "${table.name}"?`)) {
      try {
        if (table.familyGroupId) {
          await this.tableMergeService.separatePermanentFamily(table.familyGroupId);
        }
        await this.tableService.deleteTable(table.id);
      } catch (error) {
        console.error('Error deleting table:', error);
        alert('Error al eliminar la mesa');
      }
    }
  }

  async updateTableStatus(table: Table, status: 'free' | 'occupied' | 'reserved') {
    try {
      await this.tableService.updateTable(table.id, { status });
    } catch (error) {
      console.error('Error updating table status:', error);
      alert('Error al actualizar el estado de la mesa');
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingTable = null;
    this.resetForm();
  }

  private resetForm() {
    this.newTable = {
      branchId: '',
      number: 0,
      status: 'free',
      capacity: 4
    };
  }

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  }

  // Permanent merge mode
  toggleMergeMode() {
    this.showMergeMode = !this.showMergeMode;
    if (!this.showMergeMode) {
      this.selectedForMerge = new Set();
    }
  }

  toggleTableForMerge(tableId: string) {
    if (this.selectedForMerge.has(tableId)) {
      this.selectedForMerge.delete(tableId);
    } else {
      this.selectedForMerge.add(tableId);
    }
  }

  isTableSelectedForMerge(tableId: string): boolean {
    return this.selectedForMerge.has(tableId);
  }

  async confirmPermanentMerge() {
    const ids = Array.from(this.selectedForMerge);
    if (ids.length < 2) {
      alert('Selecciona al menos 2 mesas para unir permanentemente');
      return;
    }
    try {
      await this.tableMergeService.mergeTablesPermanent(ids, '');
      this.showMergeMode = false;
      this.selectedForMerge = new Set();
    } catch (error) {
      console.error('Error creating permanent family:', error);
      alert('Error al crear mesa familiar permanente');
    }
  }

  async separatePermanentFamily(familyGroupId: string) {
    if (confirm('¿Separar esta mesa familiar? Las mesas volverán a ser individuales.')) {
      try {
        await this.tableMergeService.separatePermanentFamily(familyGroupId);
      } catch (error) {
        console.error('Error separating permanent family:', error);
        alert('Error al separar mesa familiar permanente');
      }
    }
  }

  getFamilyStatusLabel(status: string): string {
    return status === 'family_merged' ? 'Disponible' : status;
  }

  adjustNumericField(target: any, key: string, delta: number, min: number = 0) {
    const current = Number(target[key]) || 0;
    target[key] = Math.max(min, current + delta);
  }
}
