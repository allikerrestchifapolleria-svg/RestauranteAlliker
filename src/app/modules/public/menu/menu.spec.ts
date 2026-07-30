import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Menu } from './menu';
import { MenuService } from '../../../services/menu';
import { CartService } from '../../../services/cart';
import { MenuCategoryService } from '../../../services/menu-category';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MenuItem } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';

const mockItems: MenuItem[] = [
  { id: '1', name: 'Ceviche', price: 32, description: 'Pescado fresco', categoryId: 'cat1', image: '', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Lomo Saltado', price: 28, description: 'Saltado de lomo', categoryId: 'cat2', image: '', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Suspiro Limeño', price: 18, description: 'Postre tradicional', categoryId: 'veg1', image: '', isAvailable: false, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
];

const mockCategories: MenuCategory[] = [
  { id: 'cat1', name: 'Entradas', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat2', name: 'Principales', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat3', name: 'Postres', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'veg1', name: 'Vegetarianos', active: true, createdAt: new Date(), updatedAt: new Date() },
];

describe('Menu Component', () => {
  let component: Menu;
  let fixture: ComponentFixture<Menu>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let menuServiceSpy: jasmine.SpyObj<MenuService>;
  let categoryServiceSpy: jasmine.SpyObj<MenuCategoryService>;
  let router: Router;

  beforeEach(async () => {
    cartServiceSpy = jasmine.createSpyObj('CartService', ['addToCart', 'getCartItemCount', 'getCartTotal']);
    menuServiceSpy = jasmine.createSpyObj('MenuService', ['getMenuItems']);
    categoryServiceSpy = jasmine.createSpyObj('MenuCategoryService', ['getCategories']);

    menuServiceSpy.getMenuItems.and.returnValue(of(mockItems));
    categoryServiceSpy.getCategories.and.returnValue(of(mockCategories));
    cartServiceSpy.getCartItemCount.and.returnValue(0);
    cartServiceSpy.getCartTotal.and.returnValue(0);

    await TestBed.configureTestingModule({
      imports: [Menu],
      providers: [
        { provide: CartService, useValue: cartServiceSpy },
        { provide: MenuService, useValue: menuServiceSpy },
        { provide: MenuCategoryService, useValue: categoryServiceSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Menu);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load items and categories on init', () => {
    expect(component.allItems.length).toBe(3);
    expect(component.allCategories.length).toBe(3);
  });

  it('should filter by category', () => {
    component.filterByCategory('cat1');
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Ceviche');
  });

  it('should show all items when category is "all"', () => {
    component.filterByCategory('all');
    expect(component.filteredItems.length).toBe(3);
  });

  it('should filter by search term', () => {
    component.searchTerm = 'ceviche';
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
  });

  it('should filter by search term case-insensitive', () => {
    component.searchTerm = 'CEVICHE';
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
  });

  it('should filter by availability', () => {
    component.showAvailableOnly = true;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(2);
  });

  it('should filter by vegetarian', () => {
    component.showVegetarianOnly = true;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Suspiro Limeño');
  });

  it('should clear search', () => {
    component.searchTerm = 'ceviche';
    component.clearSearch();
    expect(component.searchTerm).toBe('');
    expect(component.filteredItems.length).toBe(3);
  });

  it('should clear all filters', () => {
    component.selectedCategory = 'cat1';
    component.searchTerm = 'dulce';
    component.clearAllFilters();
    expect(component.selectedCategory).toBe('all');
    expect(component.searchTerm).toBe('');
    expect(component.filteredItems.length).toBe(3);
  });

  it('should get category count', () => {
    expect(component.getCategoryCount('cat1')).toBe(1);
    expect(component.getCategoryCount('veg1')).toBe(1);
  });

  it('should get category name from id', () => {
    expect(component.getCategoryName('cat1')).toBe('Entradas');
    expect(component.getCategoryName('unknown')).toBe('unknown');
  });

  it('should call addToCart on cart service', () => {
    component.addToCart(mockItems[0]);
    expect(cartServiceSpy.addToCart).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should navigate to cart', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToCart();
    expect(navigateSpy).toHaveBeenCalledWith(['/cart']);
  });

  it('should navigate to reservations', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToReservations();
    expect(navigateSpy).toHaveBeenCalledWith(['/reservations']);
  });

  it('should call tel: on callNow', () => {
    let assignedUrl = '';
    Object.defineProperty(window, 'location', {
      value: { href: '', assign: (url: string) => assignedUrl = url },
      writable: true
    });
    component.callNow();
  });

  it('should return cart item count', () => {
    cartServiceSpy.getCartItemCount.and.returnValue(3);
    expect(component.getCartItemCount()).toBe(3);
  });

  it('should return cart total', () => {
    cartServiceSpy.getCartTotal.and.returnValue(100);
    expect(component.getCartTotal()).toBe(100);
  });
});
