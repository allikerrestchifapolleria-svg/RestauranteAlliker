import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicLayoutComponent } from './public-layout';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

describe('PublicLayoutComponent', () => {
  let component: PublicLayoutComponent;
  let fixture: ComponentFixture<PublicLayoutComponent>;
  let authSpy: jasmine.SpyObj<Auth>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('Auth', ['getCurrentUser', 'logout']);

    await TestBed.configureTestingModule({
      imports: [PublicLayoutComponent],
      providers: [
        { provide: Auth, useValue: authSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicLayoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set isLoggedIn to false when no user', () => {
    authSpy.getCurrentUser.and.returnValue(null);
    fixture.detectChanges();
    expect(component.isLoggedIn).toBeFalse();
    expect(component.isAdmin).toBeFalse();
  });

  it('should set isLoggedIn to true with user', () => {
    authSpy.getCurrentUser.and.returnValue({ email: 'test@test.com', role: 'user' } as any);
    fixture.detectChanges();
    expect(component.isLoggedIn).toBeTrue();
    expect(component.isAdmin).toBeFalse();
  });

  it('should set isAdmin for admin users', () => {
    authSpy.getCurrentUser.and.returnValue({ email: 'admin@test.com', role: 'admin' } as any);
    fixture.detectChanges();
    expect(component.isAdmin).toBeTrue();
  });

  it('should update isScrolled on scroll', () => {
    expect(component.isScrolled).toBeFalse();
    window.scrollY = 100;
    component.onWindowScroll();
    expect(component.isScrolled).toBeTrue();
    window.scrollY = 0;
    component.onWindowScroll();
    expect(component.isScrolled).toBeFalse();
  });

  it('should logout and navigate to home', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.logout();
    expect(authSpy.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('should navigate to admin dashboard', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToAdmin();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/dashboard']);
  });
});
