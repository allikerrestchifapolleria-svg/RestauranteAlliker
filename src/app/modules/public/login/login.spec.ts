import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';
import { Auth, UserRole } from '../../../services/auth';
import { BranchSelectionService } from '../../../services/branch-selection';
import { BranchService } from '../../../services/branch';
import { Router, ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authSpy: jasmine.SpyObj<Auth>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('Auth', ['login', 'getUserBranchId']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['setBranches', 'initializeFromUserBranch', 'getSelectedBranchId']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);

    authSpy.getUserBranchId.and.returnValue(null as any);
    branchSelectionSpy.getSelectedBranchId.and.returnValue('');

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values', () => {
    expect(component.loginForm.get('email')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
    expect(component.loginForm.get('rememberMe')?.value).toBeFalse();
  });

  it('should require email field', () => {
    const email = component.loginForm.get('email');
    email?.setValue('');
    expect(email?.hasError('required')).toBeTrue();
  });

  it('should validate email format', () => {
    const email = component.loginForm.get('email');
    email?.setValue('invalid');
    expect(email?.hasError('email')).toBeTrue();
    email?.setValue('test@test.com');
    expect(email?.hasError('email')).toBeFalse();
  });

  it('should require password with minlength 6', () => {
    const pwd = component.loginForm.get('password');
    pwd?.setValue('123');
    expect(pwd?.hasError('minlength')).toBeTrue();
    pwd?.setValue('123456');
    expect(pwd?.hasError('minlength')).toBeFalse();
  });

  it('should not submit invalid form', () => {
    component.onSubmit();
    expect(component.errorMessage).toBe('Por favor complete todos los campos correctamente');
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('should login and redirect admin', (done) => {
    authSpy.login.and.returnValue(Promise.resolve({ success: true, role: 'admin' as UserRole }));
    branchServiceSpy.getBranches.and.returnValue(of([]));

    const navigateSpy = spyOn(router, 'navigate');

    component.loginForm.get('email')?.setValue('admin@test.com');
    component.loginForm.get('password')?.setValue('123456');
    component.onSubmit();

    setTimeout(() => {
      expect(authSpy.login).toHaveBeenCalledWith('admin@test.com', '123456');
      expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
      done();
    }, 1500);
  });

  it('should login and redirect waiter to no-branch', (done) => {
    authSpy.login.and.returnValue(Promise.resolve({ success: true, role: 'waiter' as UserRole }));
    branchServiceSpy.getBranches.and.returnValue(of([]));
    authSpy.getUserBranchId.and.returnValue(null as any);
    branchSelectionSpy.getSelectedBranchId.and.returnValue('');

    const navigateSpy = spyOn(router, 'navigate');

    component.loginForm.get('email')?.setValue('waiter@test.com');
    component.loginForm.get('password')?.setValue('123456');
    component.onSubmit();

    setTimeout(() => {
      expect(authSpy.login).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/no-branch']);
      done();
    }, 1500);
  });

  it('should login and redirect role user to home', (done) => {
    authSpy.login.and.returnValue(Promise.resolve({ success: true, role: 'user' as UserRole }));
    branchServiceSpy.getBranches.and.returnValue(of([]));

    const navigateSpy = spyOn(router, 'navigate');

    component.loginForm.get('email')?.setValue('user@test.com');
    component.loginForm.get('password')?.setValue('123456');
    component.onSubmit();

    setTimeout(() => {
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
      done();
    }, 1500);
  });

  it('should handle login failure', (done) => {
    authSpy.login.and.returnValue(Promise.resolve({ success: false, message: 'Invalid credentials' }));

    component.loginForm.get('email')?.setValue('bad@test.com');
    component.loginForm.get('password')?.setValue('123456');
    component.onSubmit();

    setTimeout(() => {
      expect(component.errorMessage).toBe('Credenciales inválidas. Verifica tu email y contraseña.');
      done();
    }, 100);
  });

  it('should handle login error', (done) => {
    authSpy.login.and.returnValue(Promise.reject('Network error'));

    component.loginForm.get('email')?.setValue('test@test.com');
    component.loginForm.get('password')?.setValue('123456');
    component.onSubmit();

    setTimeout(() => {
      expect(component.errorMessage).toBe('Error de conexión. Inténtalo de nuevo.');
      done();
    }, 100);
  });

  it('should toggle password visibility', () => {
    component.showPassword = false;
    component.togglePasswordVisibility();
    expect(component.showPassword).toBeTrue();
    component.togglePasswordVisibility();
    expect(component.showPassword).toBeFalse();
  });

  it('should navigate to register', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToRegister();
    expect(navigateSpy).toHaveBeenCalledWith(['/register']);
  });
});
