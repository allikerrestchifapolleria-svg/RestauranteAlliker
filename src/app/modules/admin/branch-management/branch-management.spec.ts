import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BranchManagement } from './branch-management';
import { BranchService } from '../../../services/branch';
import { of } from 'rxjs';
import { Branch } from '../../../models/branch';

const now = new Date();
const mockBranches: Branch[] = [
  { id: 'b1', name: 'Centro', address: 'Av. Central 123', phone: '999888777', branchId: 'SUCC001', status: 'open', openingHours: {} as any, createdAt: now, updatedAt: now },
  { id: 'b2', name: 'Norte', address: 'Av. Norte 456', phone: '999888666', branchId: 'SUCC002', status: 'open', openingHours: {} as any, createdAt: now, updatedAt: now },
];

describe('BranchManagement', () => {
  let component: BranchManagement;
  let fixture: ComponentFixture<BranchManagement>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;

  beforeEach(async () => {
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches', 'createBranch', 'updateBranch', 'deleteBranch']);
    branchServiceSpy.getBranches.and.returnValue(of(mockBranches));

    await TestBed.configureTestingModule({
      imports: [BranchManagement],
      providers: [
        { provide: BranchService, useValue: branchServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BranchManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load branches on init', () => {
    expect(branchServiceSpy.getBranches).toHaveBeenCalled();
  });

  it('should filter branches by search', () => {
    component.searchTerm = 'Centro';
    component.onSearch();
    expect(component.filteredBranches$).toBeTruthy();
  });

  it('should open add form', () => {
    component.addNewBranch();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingBranch).toBeNull();
  });

  it('should edit branch', () => {
    component.editBranch(mockBranches[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingBranch?.id).toBe('b1');
  });

  it('should validate name on save', async () => {
    spyOn(window, 'alert');
    component.newBranch.name = 'Centro123';
    await component.saveBranch();
    expect(component.nameError).toBe('Solo se permiten letras y espacios');
  });

  it('should validate phone on save', async () => {
    component.newBranch.name = 'Centro';
    component.newBranch.phone = 'abc123';
    await component.saveBranch();
    expect(component.phoneError).toBe('Solo se permiten números (máximo 9 dígitos)');
  });

  it('should create new branch', async () => {
    branchServiceSpy.createBranch.and.returnValue(Promise.resolve());
    component.newBranch.name = 'Sur';
    component.newBranch.branchId = 'SUCC003';
    await component.saveBranch();
    expect(branchServiceSpy.createBranch).toHaveBeenCalled();
  });

  it('should update existing branch', async () => {
    branchServiceSpy.updateBranch.and.returnValue(Promise.resolve());
    component.editingBranch = mockBranches[0];
    component.newBranch = { ...mockBranches[0], name: 'Centro Updated' };
    await component.saveBranch();
    expect(branchServiceSpy.updateBranch).toHaveBeenCalled();
  });

  it('should cancel edit', () => {
    component.showAddForm = true;
    component.editingBranch = mockBranches[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingBranch).toBeNull();
  });

  it('should get opening hour', () => {
    expect(component.getOpeningHour('lunes', 'open')).toBe('12:00');
    expect(component.getOpeningHour('lunes', 'close')).toBe('22:00');
  });

  it('should update opening hour', () => {
    component.updateOpeningHour('lunes', 'open', '10:00');
    expect(component.newBranch.openingHours?.['lunes']?.open).toBe('10:00');
  });

  it('should filter name input', () => {
    const event = { target: { value: 'Centro123' } } as any;
    component.onNameInput(event);
    expect(component.newBranch.name).toBe('Centro');
  });

  it('should filter phone input', () => {
    const event = { target: { value: '999888777abc' } } as any;
    component.onPhoneInput(event);
    expect(component.newBranch.phone).toBe('999888777');
  });

  it('should generate next branchId', () => {
    component.onRestaurantChange();
    expect(component.newBranch.branchId).toBe('SUCC003');
  });
});
