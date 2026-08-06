import { fakeAsync, tick } from '@angular/core/testing';
import { TableMergeService } from './table-merge';
import { TableService } from './table';
import { Table } from '../models/table';
import { of } from 'rxjs';

function createMockTable(id: string, overrides: Partial<Table> = {}): Table {
  return {
    id,
    number: parseInt(id),
    name: `Mesa ${id}`,
    capacity: 4,
    branchId: 'branch1',
    status: 'available',
    familyGroupId: null,
    permanentFamily: false,
    currentOrderId: null,
    occupiedTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TableMergeService', () => {
  let service: TableMergeService;
  let tableServiceSpy: jasmine.SpyObj<TableService>;

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables', 'updateTable']);

    tableServiceSpy.getTables.and.returnValue(of([]));

    service = new TableMergeService(tableServiceSpy);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('mergeTables', () => {
    it('should throw when merging less than 2 tables', async () => {
      await expectAsync(service.mergeTables(['t1'], 'branch1')).toBeRejectedWithError(
        'Se necesitan al menos 2 mesas para crear una mesa familiar'
      );
    });

    it('should merge 2 tables successfully', async () => {
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const familyId = await service.mergeTables(['t1', 't2'], 'branch1');

      expect(familyId).toContain('fam_');
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', {
        familyGroupId: familyId,
        status: 'family_merged',
      });
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t2', {
        familyGroupId: familyId,
        status: 'family_merged',
      });
    });

    it('should merge 3 tables', async () => {
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const familyId = await service.mergeTables(['t1', 't2', 't3'], 'branch1');

      expect(tableServiceSpy.updateTable).toHaveBeenCalledTimes(3);
    });
  });

  describe('mergeTablesPermanent', () => {
    it('should throw when merging less than 2 tables', async () => {
      await expectAsync(service.mergeTablesPermanent(['t1'], 'branch1')).toBeRejectedWithError(
        'Se necesitan al menos 2 mesas para crear una mesa familiar'
      );
    });

    it('should merge tables with permanentFamily flag', async () => {
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const familyId = await service.mergeTablesPermanent(['t1', 't2'], 'branch1');

      expect(familyId).toContain('fam_');
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', {
        familyGroupId: familyId,
        permanentFamily: true,
        status: 'family_merged',
      });
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t2', {
        familyGroupId: familyId,
        permanentFamily: true,
        status: 'family_merged',
      });
    });
  });

  describe('unmergeTables', () => {
    it('should unmerge all tables in family group', fakeAsync(async () => {
      const tables: Table[] = [
        createMockTable('t1', { familyGroupId: 'fam1', status: 'family_merged' }),
        createMockTable('t2', { familyGroupId: 'fam1', status: 'family_merged' }),
      ];
      tableServiceSpy.getTables.and.returnValue(of(tables));
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const promise = service.unmergeTables('fam1');
      tick();
      await promise;

      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', {
        familyGroupId: null,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t2', {
        familyGroupId: null,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
    }));
  });

  describe('completeFamilyOrder', () => {
    it('should keep familyGroupId for permanent families', fakeAsync(async () => {
      const tables: Table[] = [
        createMockTable('t1', { familyGroupId: 'fam1', permanentFamily: true, status: 'family_merged' }),
        createMockTable('t2', { familyGroupId: 'fam1', permanentFamily: true, status: 'family_merged' }),
      ];
      tableServiceSpy.getTables.and.returnValue(of(tables));
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const promise = service.completeFamilyOrder('fam1', 'order1');
      tick();
      await promise;

      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', {
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t2', {
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
    }));

    it('should remove familyGroupId for temporary families', fakeAsync(async () => {
      const tables: Table[] = [
        createMockTable('t1', { familyGroupId: 'fam1', permanentFamily: false, status: 'family_merged' }),
        createMockTable('t2', { familyGroupId: 'fam1', permanentFamily: false, status: 'family_merged' }),
      ];
      tableServiceSpy.getTables.and.returnValue(of(tables));
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const promise = service.completeFamilyOrder('fam1', 'order1');
      tick();
      await promise;

      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', {
        familyGroupId: null,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
    }));
  });

  describe('separatePermanentFamily', () => {
    it('should remove familyGroupId and permanentFamily flag', fakeAsync(async () => {
      const tables: Table[] = [
        createMockTable('t1', { familyGroupId: 'fam1', permanentFamily: true, status: 'family_merged' }),
        createMockTable('t2', { familyGroupId: 'fam1', permanentFamily: true, status: 'family_merged' }),
      ];
      tableServiceSpy.getTables.and.returnValue(of(tables));
      tableServiceSpy.updateTable.and.returnValue(Promise.resolve());

      const promise = service.separatePermanentFamily('fam1');
      tick();
      await promise;

      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', {
        familyGroupId: null,
        permanentFamily: false,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
      expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t2', {
        familyGroupId: null,
        permanentFamily: false,
        status: 'available',
        currentOrderId: null,
        occupiedTime: null,
      });
    }));
  });

  describe('getFamilyGroup', () => {
    it('should return tables in the family group', (done) => {
      const tables: Table[] = [
        createMockTable('t1', { familyGroupId: 'fam1' }),
        createMockTable('t2', { familyGroupId: 'fam1' }),
        createMockTable('t3', { familyGroupId: 'fam2' }),
      ];
      tableServiceSpy.getTables.and.returnValue(of(tables));

      service.getFamilyGroup('fam1').subscribe(result => {
        expect(result.length).toBe(2);
        expect(result[0].id).toBe('t1');
        expect(result[1].id).toBe('t2');
        done();
      });
    });
  });
});
