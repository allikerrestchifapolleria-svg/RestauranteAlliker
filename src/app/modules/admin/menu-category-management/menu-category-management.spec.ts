import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuCategoryManagement } from './menu-category-management';
import { MenuCategoryService } from '../../../services/menu-category';
import { of } from 'rxjs';
import { MenuCategory } from '../../../models/menu-category';

const now = new Date();
const mockCategories: MenuCategory[] = [
  { id: 'cat1', name: 'Entradas', active: true, createdAt: now, updatedAt: now },
  { id: 'cat2', name: 'Principales', active: true, createdAt: now, updatedAt: now },
  { id: 'cat3', name: 'Postres', active: false, createdAt: now, updatedAt: now },
];

describe('MenuCategoryManagement', () => {
  let component: MenuCategoryManagement;
  let fixture: ComponentFixture<MenuCategoryManagement>;
  let categoryServiceSpy: jasmine.SpyObj<MenuCategoryService>;

  beforeEach(async () => {
    categoryServiceSpy = jasmine.createSpyObj('MenuCategoryService', ['getCategories', 'createCategory', 'updateCategory', 'deleteCategory']);
    categoryServiceSpy.getCategories.and.returnValue(of(mockCategories));

    await TestBed.configureTestingModule({
      imports: [MenuCategoryManagement],
      providers: [
        { provide: MenuCategoryService, useValue: categoryServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MenuCategoryManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories on init', () => {
    expect(categoryServiceSpy.getCategories).toHaveBeenCalled();
  });

  it('should filter categories by search', () => {
    component.searchTerm = 'Entradas';
    component.onSearch();
    expect(component.filteredCategories$).toBeTruthy();
  });

  it('should open add form', () => {
    component.addNewCategory();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingCategory).toBeNull();
  });

  it('should edit category', () => {
    component.editCategory(mockCategories[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingCategory?.id).toBe('cat1');
  });

  it('should create new category', async () => {
    categoryServiceSpy.createCategory.and.returnValue(Promise.resolve());
    component.newCategory.name = 'Bebidas';
    await component.saveCategory();
    expect(categoryServiceSpy.createCategory).toHaveBeenCalled();
  });

  it('should update existing category', async () => {
    categoryServiceSpy.updateCategory.and.returnValue(Promise.resolve());
    component.editingCategory = mockCategories[0];
    component.newCategory = { ...mockCategories[0], name: 'Entradas Actualizado' };
    await component.saveCategory();
    expect(categoryServiceSpy.updateCategory).toHaveBeenCalled();
  });

  it('should cancel edit', () => {
    component.showAddForm = true;
    component.editingCategory = mockCategories[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingCategory).toBeNull();
  });

  it('should reset form on cancel', () => {
    component.showAddForm = true;
    component.newCategory.name = 'Test';
    component.cancelEdit();
    expect(component.newCategory.name).toBe('');
  });
});
