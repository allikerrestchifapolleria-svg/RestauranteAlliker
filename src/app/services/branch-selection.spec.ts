import { BranchSelectionService } from './branch-selection';
import { Branch } from '../models/branch';

describe('BranchSelectionService', () => {
  let service: BranchSelectionService;

  beforeEach(() => {
    localStorage.clear();
    service = new BranchSelectionService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty branchId', () => {
    expect(service.getSelectedBranchId()).toBe('');
  });

  it('should select a branch', () => {
    service.selectBranch('branch123');
    expect(service.getSelectedBranchId()).toBe('branch123');
  });

  it('should persist selected branch in localStorage', () => {
    service.selectBranch('branch456');
    expect(localStorage.getItem('selectedBranchId')).toBe('branch456');
  });

  it('should emit selected branch id through observable', (done) => {
    service.selectBranch('branch789');
    service.selectedBranchId$.subscribe(id => {
      if (id) {
        expect(id).toBe('branch789');
        done();
      }
    });
  });

  it('should return selected branch name', () => {
    const branches: Branch[] = [
      { id: 'b1', name: 'Sucursal Centro' } as Branch,
      { id: 'b2', name: 'Sucursal Norte' } as Branch,
    ];
    service.setBranches(branches);
    service.selectBranch('b1');
    expect(service.getSelectedBranchName()).toBe('Sucursal Centro');
  });

  it('should return "Sin sucursal" when no branch selected', () => {
    expect(service.getSelectedBranchName()).toBe('Sin sucursal');
  });

  it('should set branches list', () => {
    const branches: Branch[] = [
      { id: 'b1', name: 'Centro' } as Branch,
    ];
    service.setBranches(branches);
    expect(service.getSelectedBranchName()).toBe('Sin sucursal');
    service.selectBranch('b1');
    expect(service.getSelectedBranchName()).toBe('Centro');
  });

  it('should initialize from user branch when no stored value', () => {
    service.initializeFromUserBranch('userBranch1');
    expect(service.getSelectedBranchId()).toBe('userBranch1');
  });

  it('should not override stored value on initialize', () => {
    service.selectBranch('storedBranch');
    service.initializeFromUserBranch('userBranch1');
    expect(service.getSelectedBranchId()).toBe('storedBranch');
  });

  it('should select first branch when no user branch and no stored value', () => {
    const branches: Branch[] = [
      { id: 'b1', name: 'Centro' } as Branch,
    ];
    service.setBranches(branches);
    service.initializeFromUserBranch(null);
    expect(service.getSelectedBranchId()).toBe('b1');
  });

  it('should keep empty when no stored, no user branch, no branches', () => {
    service.initializeFromUserBranch(null);
    expect(service.getSelectedBranchId()).toBe('');
  });
});
