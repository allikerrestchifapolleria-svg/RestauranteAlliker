import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dishes } from './dishes';
import { CartService } from '../../../services/cart';
import { MenuService } from '../../../services/menu';
import { MenuCategoryService } from '../../../services/menu-category';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { CartSidebarService } from '../../../shared/components/cart-sidebar/cart-sidebar.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { MenuItem } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';
import { provideRouter } from '@angular/router';

const mockCategories: MenuCategory[] = [
  { id: 'entradas', name: 'Entradas', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'principales', name: 'Principales', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'postres', name: 'Postres', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'veg1', name: 'Vegetarianos', active: true, createdAt: new Date(), updatedAt: new Date() },
];

const mockItems: MenuItem[] = [
  {
    id: '1', name: 'Ceviche', price: 32, description: 'Pescado fresco',
    categoryId: 'entradas', image: '', isAvailable: true,
    tags: ['popular'], variants: [], modifiers: [],
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: '2', name: 'Lomo Saltado', price: 28, description: 'Saltado de lomo',
    categoryId: 'principales', image: '', isAvailable: true,
    tags: [], variants: [], modifiers: [],
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: '3', name: 'Suspiro Limeño', price: 18, description: 'Postre tradicional',
    categoryId: 'veg1', image: '', isAvailable: false,
    tags: [], variants: [], modifiers: [],
    createdAt: new Date(), updatedAt: new Date(),
  },
];

describe('Dishes Component', () => {
  let component: Dishes;
  let fixture: ComponentFixture<Dishes>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let menuServiceSpy: jasmine.SpyObj<MenuService>;
  let categoryServiceSpy: jasmine.SpyObj<MenuCategoryService>;
  let availabilityServiceSpy: jasmine.SpyObj<MenuAvailabilityService>;
  let cartSidebarServiceSpy: jasmine.SpyObj<CartSidebarService>;
  let router: Router;

  beforeEach(async () => {
    cartServiceSpy = jasmine.createSpyObj('CartService', ['addToCart', 'getCartItemCount', 'getCartTotal']);
    menuServiceSpy = jasmine.createSpyObj('MenuService', ['getMenuItems']);
    categoryServiceSpy = jasmine.createSpyObj('MenuCategoryService', ['getCategories']);
    availabilityServiceSpy = jasmine.createSpyObj('MenuAvailabilityService', [
      'getPeriods', 'getSchedule', 'now$', 'startClock', 'isItemAvailable', 'getItemPeriodLabel'
    ]);
    cartSidebarServiceSpy = jasmine.createSpyObj('CartSidebarService', ['open']);

    menuServiceSpy.getMenuItems.and.returnValue(of(mockItems));
    categoryServiceSpy.getCategories.and.returnValue(of(mockCategories));
    cartServiceSpy.getCartItemCount.and.returnValue(0);
    cartServiceSpy.getCartTotal.and.returnValue(0);
    availabilityServiceSpy.getPeriods.and.returnValue(of([]));
    availabilityServiceSpy.getSchedule.and.returnValue(of({ closedDays: [], closedDates: [], closedMessage: '' }));
    availabilityServiceSpy.now$ = of(new Date()) as any;
    availabilityServiceSpy.isItemAvailable.and.callFake((item: MenuItem) => item.isAvailable);
    availabilityServiceSpy.getItemPeriodLabel.and.returnValue('');

    await TestBed.configureTestingModule({
      imports: [Dishes],
      providers: [
        { provide: CartService, useValue: cartServiceSpy },
        { provide: MenuService, useValue: menuServiceSpy },
        { provide: MenuCategoryService, useValue: categoryServiceSpy },
        { provide: MenuAvailabilityService, useValue: availabilityServiceSpy },
        { provide: CartSidebarService, useValue: cartSidebarServiceSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Dishes);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load menu items on init', () => {
    expect(menuServiceSpy.getMenuItems).toHaveBeenCalled();
    expect(component.menuItems.length).toBe(3);
    expect(component.filteredItems.length).toBe(3);
  });

  it('should load active categories from category service', () => {
    expect(component.categories.length).toBe(4);
    expect(component.categories.find(c => c.id === 'entradas')).toBeTruthy();
  });

  it('should filter by category', () => {
    component.filterByCategory('entradas');
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
    expect(component.filteredItems[0].name).toBe('Ceviche');
  });

  it('should filter by search term case-insensitive', () => {
    component.searchTerm = 'CEVICHE';
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
  });

  it('should filter by search in description', () => {
    component.searchTerm = 'saltado';
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Lomo Saltado');
  });

  it('should filter by availability', () => {
    component.showAvailableOnly = true;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(2);
    expect(component.filteredItems.find(i => i.name === 'Suspiro Limeño')).toBeUndefined();
  });

  it('should show items outside their sale window but mark them unavailable', () => {
    availabilityServiceSpy.isItemAvailable.and.callFake((item: MenuItem) => item.id !== '2');
    component.showAvailableOnly = false;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(3);
    expect(component.isItemCurrentlyAvailable(mockItems[1])).toBeFalse();
    expect(component.isItemCurrentlyAvailable(mockItems[0])).toBeTrue();
  });

  it('should hide out-of-sale-window items when "Solo disponibles" is active', () => {
    availabilityServiceSpy.isItemAvailable.and.callFake((item: MenuItem) => item.id !== '2');
    component.showAvailableOnly = true;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(2);
    expect(component.filteredItems.find(i => i.id === '2')).toBeUndefined();
  });

  it('should return the sale period label of an item', () => {
    availabilityServiceSpy.getItemPeriodLabel.and.returnValue('Noche 17:00-01:00');
    expect(component.getItemPeriodLabel(mockItems[0])).toBe('Noche 17:00-01:00');
  });

  it('should filter by vegetarian', () => {
    component.showVegetarianOnly = true;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Suspiro Limeño');
  });

  it('should combine multiple filters', () => {
    component.searchTerm = 'limeño';
    component.showVegetarianOnly = true;
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
  });

  it('should clear search', () => {
    component.searchTerm = 'ceviche';
    component.clearSearch();
    expect(component.searchTerm).toBe('');
    expect(component.filteredItems.length).toBe(3);
  });

  it('should clear all filters', () => {
    component.selectedCategory = 'postres';
    component.searchTerm = 'dulce';
    component.showAvailableOnly = true;
    component.showVegetarianOnly = true;

    component.clearAllFilters();

    expect(component.selectedCategory).toBe('all');
    expect(component.searchTerm).toBe('');
    expect(component.showAvailableOnly).toBeFalse();
    expect(component.showVegetarianOnly).toBeFalse();
    expect(component.filteredItems.length).toBe(3);
  });

  it('should get category count', () => {
    expect(component.getCategoryCount('entradas')).toBe(1);
    expect(component.getCategoryCount('principales')).toBe(1);
    expect(component.getCategoryCount('postres')).toBe(0);
    expect(component.getCategoryCount('bebidas')).toBe(0);
  });

  it('should get total items count', () => {
    expect(component.getTotalItems()).toBe(3);
  });

  it('should get category name', () => {
    expect(component.getCategoryName('entradas')).toBe('Entradas');
    expect(component.getCategoryName('principales')).toBe('Principales');
    expect(component.getCategoryName('unknown')).toBe('unknown');
  });

  it('should call addToCart on cart service', () => {
    const item = mockItems[0];
    component.addToCart(item);
    expect(cartServiceSpy.addToCart).toHaveBeenCalledWith(item);
  });

  it('should open cart sidebar', () => {
    component.openCartSidebar();
    expect(cartSidebarServiceSpy.open).toHaveBeenCalled();
  });

  it('should navigate to reservations when goToReservations is called', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goToReservations();
    expect(navigateSpy).toHaveBeenCalledWith(['/reservations']);
  });

  it('should handle empty menu items gracefully', () => {
    menuServiceSpy.getMenuItems.and.returnValue(of([]));
    component.ngOnInit();
    expect(component.menuItems.length).toBe(0);
    expect(component.filteredItems.length).toBe(0);
  });

  it('should return cart item count from service', () => {
    cartServiceSpy.getCartItemCount.and.returnValue(5);
    expect(component.getCartItemCount()).toBe(5);
  });

  it('should return cart total from service', () => {
    cartServiceSpy.getCartTotal.and.returnValue(100);
    expect(component.getCartTotal()).toBe(100);
  });
});
