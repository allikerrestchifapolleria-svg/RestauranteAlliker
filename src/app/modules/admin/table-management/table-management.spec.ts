import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableManagement } from './table-management';
import { TableService } from '../../../services/table';
import { BranchService } from '../../../services/branch';
import { TableMergeService } from '../../../services/table-merge';
import { of } from 'rxjs';
import { Table } from '../../../models/table';
import { Branch } from '../../../models/branch';

const now = new Date();
const mockTables: Table[] = [
  { id: 't1', number: 1, name: 'Mesa 1', capacity: 4, branchId: 'b1', status: 'free', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't2', number: 2, name: 'Mesa 2', capacity: 2, branchId: 'b1', status: 'occupied', familyGroupId: null, permanentFamily: false, currentOrderId: 'o1', occupiedTime: new Date(), createdAt: now, updatedAt: now },
  { id: 't3', number: 3, name: 'Mesa 3', capacity: 6, branchId: 'b1', status: 'free', familyGroupId: 'fam1', permanentFamily: true, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't4', number: 4, name: 'Mesa 4', capacity: 4, branchId: 'b1', status: 'free', familyGroupId: 'fam1', permanentFamily: true, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
];

const mockBranches: Branch[] = [
  { id: 'b1', name: 'Sucursal Centro', address: 'Av. Central 123', phone: '999888777', branchId: 'SUCC001', status: 'open', openingHours: {}, createdAt: now, updatedAt: now },
];

describe('TableManagement', () => {
  let component: TableManagement;
  let fixture: ComponentFixture<TableManagement>;
  let tableServiceSpy: jasmine.SpyObj<TableService>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let tableMergeServiceSpy: jasmine.SpyObj<TableMergeService>;

  beforeEach(async () => {
    tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables', 'createTable', 'updateTable', 'deleteTable']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);
    tableMergeServiceSpy = jasmine.createSpyObj('TableMergeService', ['mergeTablesPermanent', 'separatePermanentFamily']);

    tableServiceSpy.getTables.and.returnValue(of(mockTables));
    branchServiceSpy.getBranches.and.returnValue(of(mockBranches));

    await TestBed.configureTestingModule({
      imports: [TableManagement],
      providers: [
        { provide: TableService, useValue: tableServiceSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: TableMergeService, useValue: tableMergeServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TableManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load branches on init', () => {
    expect(branchServiceSpy.getBranches).toHaveBeenCalled();
    expect(component.branches.length).toBe(1);
  });

  it('should filter out permanent family tables from main list', (done) => {
    component.filteredTables$.subscribe(tables => {
      const hasPermanentFamily = tables.some(t => t.permanentFamily && t.familyGroupId);
      expect(hasPermanentFamily).toBeFalse();
      done();
    });
  });

  it('should compute permanent families', (done) => {
    component.permanentFamilies$.subscribe(families => {
      expect(families.length).toBe(1);
      expect(families[0]._children.length).toBe(2);
      done();
    });
  });

  it('should search tables', () => {
    component.searchTerm = 'Mesa 2';
    component.onSearch();
    expect(component.filteredTables$).toBeTruthy();
  });

  it('should add new table form', () => {
    component.addNewTable();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingTable).toBeNull();
  });

  it('should edit table', () => {
    component.editTable(mockTables[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingTable?.id).toBe('t1');
  });

  it('should not save without required fields', async () => {
    spyOn(window, 'alert');
    await component.saveTable();
    expect(window.alert).toHaveBeenCalledWith('Por favor complete todos los campos requeridos');
  });

  it('should create new table', async () => {
    tableServiceSpy.createTable.and.returnValue(Promise.resolve());
    component.newTable.branchId = 'b1';
    component.newTable.number = 5;
    await component.saveTable();
    expect(tableServiceSpy.createTable).toHaveBeenCalled();
  });

  it('should update existing table', async () => {
    tableServiceSpy.updateTable.and.returnValue(Promise.resolve());
    component.editingTable = mockTables[0];
    component.newTable = { ...mockTables[0], branchId: 'b1', number: 1 };
    await component.saveTable();
    expect(tableServiceSpy.updateTable).toHaveBeenCalled();
  });

  it('should cancel edit', () => {
    component.showAddForm = true;
    component.editingTable = mockTables[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingTable).toBeNull();
  });

  it('should get branch name', () => {
    expect(component.getBranchName('b1')).toBe('Sucursal Centro');
    expect(component.getBranchName('unknown')).toBe('unknown');
  });

  it('should toggle merge mode', () => {
    expect(component.showMergeMode).toBeFalse();
    component.toggleMergeMode();
    expect(component.showMergeMode).toBeTrue();
    component.toggleMergeMode();
    expect(component.showMergeMode).toBeFalse();
  });

  it('should toggle table selection for merge', () => {
    component.toggleTableForMerge('t1');
    expect(component.isTableSelectedForMerge('t1')).toBeTrue();
    component.toggleTableForMerge('t1');
    expect(component.isTableSelectedForMerge('t1')).toBeFalse();
  });

  it('should alert when merging fewer than 2 tables', () => {
    spyOn(window, 'alert');
    component.confirmPermanentMerge();
    expect(window.alert).toHaveBeenCalledWith('Selecciona al menos 2 mesas para unir permanentemente');
  });

  it('should get family status label', () => {
    expect(component.getFamilyStatusLabel('family_merged')).toBe('Disponible');
    expect(component.getFamilyStatusLabel('occupied')).toBe('occupied');
  });
});
