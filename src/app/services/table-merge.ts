import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TableService } from './table';
import { Table } from '../models/table';

@Injectable({
  providedIn: 'root'
})
export class TableMergeService {
  constructor(private tableService: TableService) {}

  async mergeTables(tableIds: string[], branchId: string): Promise<string> {
    if (tableIds.length < 2) {
      throw new Error('Se necesitan al menos 2 mesas para crear una mesa familiar');
    }

    const familyGroupId = 'fam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    for (const id of tableIds) {
      await this.tableService.updateTable(id, {
        familyGroupId,
        status: 'family_merged'
      });
    }

    return familyGroupId;
  }

  async unmergeTables(familyGroupId: string): Promise<void> {
    const tables = await this.getMergedTables(familyGroupId);

    for (const t of tables) {
      await this.tableService.updateTable(t.id, {
        familyGroupId: null,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null
      });
    }
  }

  async completeFamilyOrder(familyGroupId: string, orderId: string): Promise<void> {
    const tables = await this.getMergedTables(familyGroupId);
    const isPermanent = tables.some(t => t.permanentFamily);

    if (isPermanent) {
      const updates = tables.map(t =>
        this.tableService.updateTable(t.id, {
          status: 'available',
          currentOrderId: null,
          occupiedTime: null
        })
      );
      await Promise.all(updates);
    } else {
      const updates = tables.map(t =>
        this.tableService.updateTable(t.id, {
          familyGroupId: null,
          status: 'available',
          currentOrderId: null,
          occupiedTime: null
        })
      );
      await Promise.all(updates);
    }
  }

  private async getMergedTables(familyGroupId: string): Promise<Table[]> {
    return new Promise(resolve => {
      this.tableService.getTables().subscribe(tables => {
        const merged = tables.filter(t => t.familyGroupId === familyGroupId);
        resolve(merged);
      });
    });
  }

  getFamilyGroup(familyGroupId: string): Observable<Table[]> {
    return new Observable(observer => {
      this.tableService.getTables().subscribe(tables => {
        const merged = tables.filter(t => t.familyGroupId === familyGroupId);
        observer.next(merged);
        observer.complete();
      });
    });
  }

  async mergeTablesPermanent(tableIds: string[], branchId: string): Promise<string> {
    if (tableIds.length < 2) {
      throw new Error('Se necesitan al menos 2 mesas para crear una mesa familiar');
    }

    const familyGroupId = 'fam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    for (const id of tableIds) {
      await this.tableService.updateTable(id, {
        familyGroupId,
        permanentFamily: true,
        status: 'family_merged'
      });
    }

    return familyGroupId;
  }

  async separatePermanentFamily(familyGroupId: string): Promise<void> {
    const tables = await this.getMergedTables(familyGroupId);

    for (const t of tables) {
      await this.tableService.updateTable(t.id, {
        familyGroupId: null,
        permanentFamily: false,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null
      });
    }
  }
}