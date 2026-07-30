import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuManagement } from './menu-management';
import { MenuService } from '../../../services/menu';
import { MenuCategoryService } from '../../../services/menu-category';
import { of } from 'rxjs';
import { MenuItem } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';

const mockItems: MenuItem[] = [
  { id: 'm1', name: 'Ceviche', description: 'Pescado fresco', price: 32, image: '', categoryId: 'cat1', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'm2', name: 'Lomo Saltado', description: 'Saltado de lomo', price: 28, image: '', categoryId: 'cat2', isAvailable: true, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'm3', name: 'Ají de Gallina', description: 'Plato tradicional', price: 25, image: '', categoryId: 'cat1', isAvailable: false, tags: [], variants: [], modifiers: [], createdAt: new Date(), updatedAt: new Date() },
];

const now = new Date();
const mockCategories: MenuCategory[] = [
  { id: 'cat1', name: 'Entradas', active: true, createdAt: now, updatedAt: now },
  { id: 'cat2', name: 'Principales', active: true, createdAt: now, updatedAt: now },
  { id: 'cat3', name: 'Inactiva', active: false, createdAt: now, updatedAt: now },
];

describe('MenuManagement', () => {
  let component: MenuManagement;
  let fixture: ComponentFixture<MenuManagement>;
  let menuServiceSpy: jasmine.SpyObj<MenuService>;
  let categoryServiceSpy: jasmine.SpyObj<MenuCategoryService>;

  beforeEach(async () => {
    menuServiceSpy = jasmine.createSpyObj('MenuService', ['getMenuItems', 'addMenuItem', 'updateMenuItem', 'deleteMenuItem']);
    categoryServiceSpy = jasmine.createSpyObj('MenuCategoryService', ['getCategories']);

    menuServiceSpy.getMenuItems.and.returnValue(of(mockItems));
    categoryServiceSpy.getCategories.and.returnValue(of(mockCategories));

    await TestBed.configureTestingModule({
      imports: [MenuManagement],
      providers: [
        { provide: MenuService, useValue: menuServiceSpy },
        { provide: MenuCategoryService, useValue: categoryServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MenuManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load items on init', () => {
    expect(menuServiceSpy.getMenuItems).toHaveBeenCalled();
    expect(categoryServiceSpy.getCategories).toHaveBeenCalled();
  });

  it('should filter active categories', () => {
    expect(component.categories.length).toBe(2);
    expect(component.categories.some(c => c.name === 'Inactiva')).toBeFalse();
  });

  it('should filter items by category', () => {
    component.filterByCategory('cat1');
    expect(component.filteredItems$).toBeTruthy();
  });

  it('should search items', () => {
    component.searchTerm = 'Ceviche';
    component.onSearch();
    expect(component.filteredItems$).toBeTruthy();
  });

  it('should open add form', () => {
    component.addNewItem();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingItem).toBeNull();
  });

  it('should edit item', () => {
    component.editItem(mockItems[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingItem?.id).toBe('m1');
  });

  it('should not save without required fields', () => {
    component.saveItem();
    expect(component.errorMessage).toBe('Por favor complete todos los campos requeridos');
  });

  it('should update existing item', (done) => {
    menuServiceSpy.updateMenuItem.and.returnValue(Promise.resolve());
    component.editingItem = mockItems[0];
    component.newItem = { ...mockItems[0], name: 'Ceviche Actualizado', categoryId: 'cat1', description: 'Desc', price: 35 };
    component.saveItem();

    setTimeout(() => {
      expect(menuServiceSpy.updateMenuItem).toHaveBeenCalled();
      expect(component.successMessage).toBe('Plato actualizado exitosamente');
      done();
    }, 100);
  });

  it('should add new item', (done) => {
    menuServiceSpy.addMenuItem.and.returnValue(Promise.resolve('newId'));
    component.newItem = { name: 'Nuevo Plato', categoryId: 'cat1', description: 'Desc', price: 20 };
    component.saveItem();

    setTimeout(() => {
      expect(menuServiceSpy.addMenuItem).toHaveBeenCalled();
      expect(component.successMessage).toBe('Plato agregado exitosamente');
      done();
    }, 100);
  });

  it('should cancel edit', () => {
    component.showAddForm = true;
    component.editingItem = mockItems[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingItem).toBeNull();
  });

  it('should toggle availability', (done) => {
    menuServiceSpy.updateMenuItem.and.returnValue(Promise.resolve());
    component.toggleAvailability(mockItems[0]);

    setTimeout(() => {
      expect(menuServiceSpy.updateMenuItem).toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should get category name', () => {
    expect(component.getCategoryName('cat1')).toBe('Entradas');
    expect(component.getCategoryName('unknown')).toBe('unknown');
  });
});
