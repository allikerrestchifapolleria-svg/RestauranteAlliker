import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Register } from './register';
import { UserService } from '../../../services/user';
import { Auth } from '../../../services/auth';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

describe('Register Component', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let authSpy: jasmine.SpyObj<Auth>;
  let router: Router;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj('UserService', ['createUser']);
    authSpy = jasmine.createSpyObj('Auth', ['login']);

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        { provide: UserService, useValue: userServiceSpy },
        { provide: Auth, useValue: authSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with required validators', () => {
    const form = component.form;
    expect(form.get('nombre')?.hasError('required')).toBeTrue();
    expect(form.get('apellidos')?.hasError('required')).toBeTrue();
    expect(form.get('email')?.hasError('required')).toBeTrue();
    expect(form.get('password')?.hasError('required')).toBeTrue();
    expect(form.get('confirmPassword')?.hasError('required')).toBeTrue();
  });

  it('should validate nombre with letters only', () => {
    const nombre = component.form.get('nombre');
    nombre?.setValue('Juan123');
    expect(nombre?.hasError('pattern')).toBeTrue();
    nombre?.setValue('Juan');
    expect(nombre?.hasError('pattern')).toBeFalse();
  });

  it('should validate email format', () => {
    const email = component.form.get('email');
    email?.setValue('invalid');
    expect(email?.hasError('email')).toBeTrue();
    email?.setValue('test@test.com');
    expect(email?.hasError('email')).toBeFalse();
  });

  it('should validate password minlength 6', () => {
    const pwd = component.form.get('password');
    pwd?.setValue('123');
    expect(pwd?.hasError('minlength')).toBeTrue();
    pwd?.setValue('123456');
    expect(pwd?.hasError('minlength')).toBeFalse();
  });

  it('should require acceptTerms to be true', () => {
    const terms = component.form.get('acceptTerms');
    expect(terms?.hasError('required')).toBeTrue();
    terms?.setValue(true);
    expect(terms?.hasError('required')).toBeFalse();
  });

  it('should detect password mismatch', () => {
    component.form.get('password')?.setValue('123456');
    component.form.get('confirmPassword')?.setValue('654321');
    component.form.get('confirmPassword')?.updateValueAndValidity();
    expect(component.form.get('confirmPassword')?.hasError('mismatch')).toBeTrue();
  });

  it('should clear mismatch when passwords match', () => {
    component.form.get('password')?.setValue('123456');
    component.form.get('confirmPassword')?.setValue('123456');
    component.form.get('confirmPassword')?.updateValueAndValidity();
    expect(component.form.get('confirmPassword')?.hasError('mismatch')).toBeFalse();
  });

  it('should calculate password strength 0 for empty', () => {
    component.form.get('password')?.setValue('');
    expect(component.getPasswordStrength()).toBe(0);
  });

  it('should calculate password strength correctly', () => {
    component.form.get('password')?.setValue('Abc123!');
    expect(component.getPasswordStrength()).toBe(5);
  });

  it('should return progress class based on strength', () => {
    component.form.get('password')?.setValue('a');
    expect(component.getProgressClass()).toBe('bg-danger');
    component.form.get('password')?.setValue('Abc123');
    expect(component.getProgressClass()).toBe('bg-warning');
    component.form.get('password')?.setValue('Abc123!xY');
    expect(component.getProgressClass()).toBe('bg-success');
  });

  it('should toggle password visibility', () => {
    component.showPassword = false;
    component.togglePasswordVisibility('password');
    expect(component.showPassword).toBeTrue();
    component.togglePasswordVisibility('password');
    expect(component.showPassword).toBeFalse();
  });

  it('should toggle confirm password visibility', () => {
    component.showConfirmPassword = false;
    component.togglePasswordVisibility('confirmPassword');
    expect(component.showConfirmPassword).toBeTrue();
  });

  it('should not submit invalid form', () => {
    component.onSubmit();
    expect(component.errorMessage).toBe('Por favor complete todos los campos correctamente');
    expect(userServiceSpy.createUser).not.toHaveBeenCalled();
  });

  it('should submit valid form', (done) => {
    userServiceSpy.createUser.and.returnValue(Promise.resolve());
    authSpy.login.and.returnValue(Promise.resolve({ success: true }));

    component.form.get('nombre')?.setValue('Juan');
    component.form.get('apellidos')?.setValue('Pérez');
    component.form.get('email')?.setValue('user@test.com');
    component.form.get('password')?.setValue('123456');
    component.form.get('confirmPassword')?.setValue('123456');
    component.form.get('acceptTerms')?.setValue(true);

    const navigateSpy = spyOn(router, 'navigate');
    component.onSubmit();

    setTimeout(() => {
      expect(userServiceSpy.createUser).toHaveBeenCalled();
      expect(component.successMessage).toBe('Registro exitoso. Bienvenido!');
      done();
    }, 2500);
  });

  it('should navigate to login', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToLogin();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
