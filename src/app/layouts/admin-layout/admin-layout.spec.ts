import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminLayoutComponent } from './admin-layout';
import { Auth } from '../../services/auth';
import { BranchService } from '../../services/branch';
import { BranchSelectionService } from '../../services/branch-selection';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let authSpy: jasmine.SpyObj<Auth>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('Auth', ['getUserBranchId', 'getCurrentUser', 'logout']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['setBranches', 'initializeFromUserBranch', 'getSelectedBranchId', 'selectBranch']);

    branchServiceSpy.getBranches.and.returnValue(of([]));
    branchSelectionSpy.getSelectedBranchId.and.returnValue('b1');

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize selectedBranchId', () => {
    expect(branchSelectionSpy.getSelectedBranchId).toHaveBeenCalled();
  });

  it('should load branches on init', () => {
    expect(branchServiceSpy.getBranches).toHaveBeenCalled();
  });

  it('should toggle sidebar', () => {
    expect(component.sidebarCollapsed).toBeFalse();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBeTrue();
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBeFalse();
  });

  it('should call selectBranch on branch change', () => {
    component.selectedBranchId = 'b2';
    component.onBranchChange();
    expect(branchSelectionSpy.selectBranch).toHaveBeenCalledWith('b2');
  });

  it('should return current user', () => {
    authSpy.getCurrentUser.and.returnValue({ uid: 'u1', email: 'admin@test.com', role: 'admin', branchId: 'b1' } as any);
    expect(component.getCurrentUser()).toEqual({ uid: 'u1', email: 'admin@test.com', role: 'admin', branchId: 'b1' });
  });

  it('should logout and navigate to home', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.logout();
    expect(authSpy.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('should navigate to public home', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToPublic();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
