import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KitchenLayoutComponent } from './kitchen-layout';
import { Auth } from '../../services/auth';
import { BranchService } from '../../services/branch';
import { BranchSelectionService } from '../../services/branch-selection';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('KitchenLayoutComponent', () => {
  let component: KitchenLayoutComponent;
  let fixture: ComponentFixture<KitchenLayoutComponent>;
  let authSpy: jasmine.SpyObj<Auth>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('Auth', ['getUserBranchId', 'getCurrentUser', 'logout']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['setBranches', 'initializeFromUserBranch', 'getSelectedBranchId', 'getSelectedBranchName']);

    branchServiceSpy.getBranches.and.returnValue(of([]));
    branchSelectionSpy.getSelectedBranchId.and.returnValue('b1');
    branchSelectionSpy.getSelectedBranchName.and.returnValue('Sucursal Centro');

    await TestBed.configureTestingModule({
      imports: [KitchenLayoutComponent],
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(KitchenLayoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load branches on init', () => {
    expect(branchServiceSpy.getBranches).toHaveBeenCalled();
    expect(branchSelectionSpy.setBranches).toHaveBeenCalled();
    expect(branchSelectionSpy.initializeFromUserBranch).toHaveBeenCalled();
  });

  it('should return current user', () => {
    authSpy.getCurrentUser.and.returnValue({ uid: 'u1', email: 'cook@test.com', role: 'cook', branchId: 'b1' } as any);
    expect(component.getCurrentUser()).toEqual({ uid: 'u1', email: 'cook@test.com', role: 'cook', branchId: 'b1' });
  });

  it('should return branch name', () => {
    expect(component.getBranchName()).toBe('Sucursal Centro');
  });

  it('should logout and navigate to home', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.logout();
    expect(authSpy.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
