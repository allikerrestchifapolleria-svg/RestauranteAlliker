import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home';
import { MenuService } from '../../../services/menu';
import { CartService } from '../../../services/cart';
import { CartSidebarService } from '../../../shared/components/cart-sidebar/cart-sidebar.service';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MenuItem } from '../../../models/menu-item';

const mockItems: MenuItem[] = [
  { id: '1', name: 'Ceviche', price: 32, description: 'Pescado fresco', categoryId: 'entradas', image: '', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Lomo Saltado', price: 28, description: 'Saltado de lomo', categoryId: 'principales', image: '', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Suspiro Limeño', price: 18, description: 'Postre', categoryId: 'postres', image: '', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Ají de Gallina', price: 25, description: 'Plato tradicional', categoryId: 'principales', image: '', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
];

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let menuServiceSpy: jasmine.SpyObj<MenuService>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let cartSidebarServiceSpy: jasmine.SpyObj<CartSidebarService>;
  let router: Router;

  beforeEach(async () => {
    menuServiceSpy = jasmine.createSpyObj('MenuService', ['getMenuItems']);
    menuServiceSpy.getMenuItems.and.returnValue(of(mockItems));
    cartServiceSpy = jasmine.createSpyObj('CartService', ['addToCart', 'getCartItemCount']);
    cartSidebarServiceSpy = jasmine.createSpyObj('CartSidebarService', ['open']);

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: MenuService, useValue: menuServiceSpy },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: CartSidebarService, useValue: cartSidebarServiceSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load first 3 dishes on init', () => {
    expect(component.filteredDishes.length).toBe(3);
    expect(component.filteredDishes[0].name).toBe('Ceviche');
  });

  it('should have newsletter form with email validator', () => {
    const email = component.newsletterForm.get('email');
    expect(email?.hasError('required')).toBeTrue();
    email?.setValue('invalid');
    expect(email?.hasError('email')).toBeTrue();
    expect(email?.hasError('pattern')).toBeTrue();
    email?.setValue('test@example.com');
    expect(email?.hasError('email')).toBeFalse();
    expect(email?.hasError('pattern')).toBeFalse();
  });

  it('should search dishes', () => {
    component.searchTerm = 'ceviche';
    component.onSearch();
    expect(component.filteredDishes.length).toBe(1);
    expect(component.filteredDishes[0].name).toBe('Ceviche');
  });

  it('should validate search term', () => {
    component.searchTerm = '<script>';
    component.onSearch();
    expect(component.searchError).toBe('Por favor, usa solo letras y números.');
  });

  it('should clear search error on valid search', () => {
    component.searchError = 'Previous error';
    component.searchTerm = 'ceviche';
    component.onSearch();
    expect(component.searchError).toBe('');
  });

  it('should not subscribe with invalid form', () => {
    component.onSubscribe();
    expect(component.submitted).toBeTrue();
  });

  it('should reset newsletter form after subscribe', () => {
    component.newsletterForm.get('email')?.setValue('test@test.com');
    component.onSubscribe();
    expect(component.newsletterForm.get('email')?.value).toBeNull();
    expect(component.submitted).toBeFalse();
  });

  it('should navigate to menu', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.onViewMenu();
    expect(navigateSpy).toHaveBeenCalledWith(['/menu']);
  });

  it('should navigate to reservations', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.onReserveTable();
    expect(navigateSpy).toHaveBeenCalledWith(['/reservations']);
  });

  it('should track dish by id', () => {
    const dish = mockItems[0];
    expect(component.trackByDish(0, dish)).toBe('1');
  });

  it('should return form controls', () => {
    expect(component.f).toBe(component.newsletterForm.controls);
  });

  it('should add to cart on onAddToCart', () => {
    component.onAddToCart(mockItems[0]);
    expect(cartServiceSpy.addToCart).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should get cart item count', () => {
    cartServiceSpy.getCartItemCount.and.returnValue(3);
    expect(component.getCartItemCount()).toBe(3);
  });

  it('should open cart sidebar', () => {
    component.openCartSidebar();
    expect(cartSidebarServiceSpy.open).toHaveBeenCalled();
  });
});
