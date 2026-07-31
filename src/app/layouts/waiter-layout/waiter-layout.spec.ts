import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaiterLayoutComponent } from './waiter-layout';
import { Auth } from '../../services/auth';
import { BranchService } from '../../services/branch';
import { BranchSelectionService } from '../../services/branch-selection';
import { NotificationService } from '../../services/notification';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('WaiterLayoutComponent', () => {
  let component: WaiterLayoutComponent;
  let fixture: ComponentFixture<WaiterLayoutComponent>;
  let authSpy: jasmine.SpyObj<Auth>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('Auth', ['getUserBranchId', 'getCurrentUser', 'logout', 'getUserRole']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['setBranches', 'initializeFromUserBranch', 'getSelectedBranchId', 'getSelectedBranchName']);

    branchServiceSpy.getBranches.and.returnValue(of([]));
    branchSelectionSpy.getSelectedBranchId.and.returnValue('b1');
    branchSelectionSpy.getSelectedBranchName.and.returnValue('Sucursal Centro');
    authSpy.getUserRole.and.returnValue('waiter');

    await TestBed.configureTestingModule({
      imports: [WaiterLayoutComponent],
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        { provide: NotificationService, useValue: { getNotifications: () => of([]) } },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WaiterLayoutComponent);
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

  it('should navigate to no-branch when no branch selected', () => {
    fixture.destroy();
    branchSelectionSpy.getSelectedBranchId.and.returnValue('');
    const navigateSpy = spyOn(router, 'navigate');
    const newFixture = TestBed.createComponent(WaiterLayoutComponent);
    newFixture.detectChanges();
    expect(navigateSpy).toHaveBeenCalledWith(['/no-branch']);
  });

  it('should return current user', () => {
    authSpy.getCurrentUser.and.returnValue({ uid: 'u1', email: 'waiter@test.com', role: 'waiter', branchId: 'b1' } as any);
    expect(component.getCurrentUser()).toEqual({ uid: 'u1', email: 'waiter@test.com', role: 'waiter', branchId: 'b1' });
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
