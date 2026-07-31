import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MenuCategoryService } from '../../../services/menu-category';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { MenuCategory } from '../../../models/menu-category';
import { ServicePeriod } from '../../../models/service-period';

@Component({
  selector: 'app-menu-category-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-category-management.html',
  styleUrl: './menu-category-management.css',
})
export class MenuCategoryManagement implements OnInit {
  categories$: Observable<MenuCategory[]> = new Observable<MenuCategory[]>();
  searchTerm: string = '';
  searchTerm$ = new BehaviorSubject<string>('');
  filteredCategories$: Observable<MenuCategory[]>;
  showAddForm: boolean = false;
  editingCategory: MenuCategory | null = null;

  // Form data
  newCategory: Partial<MenuCategory> = {
    name: '',
    active: true,
    defaultServicePeriodIds: []
  };
  formErrors: Record<string, string> = {};
  servicePeriods: ServicePeriod[] = [];

  constructor(
    private categoryService: MenuCategoryService,
    private availabilityService: MenuAvailabilityService
  ) {
    this.categories$ = this.categoryService.getCategories();
    this.filteredCategories$ = combineLatest([this.categories$, this.searchTerm$]).pipe(
      map(([categories, term]) =>
        categories.filter(category =>
          category.name.toLowerCase().includes(term.toLowerCase())
        )
      )
    );
  }

  ngOnInit() {
    // No need to subscribe manually, using async pipe in template
    this.availabilityService.getPeriods().subscribe(periods => {
      this.servicePeriods = periods.filter(period => period.active);
    });
  }

  toggleServicePeriod(periodId: string) {
    const current: string[] = this.newCategory.defaultServicePeriodIds || [];
    const idx = current.indexOf(periodId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(periodId);
    }
    this.newCategory.defaultServicePeriodIds = [...current];
  }

  isServicePeriodSelected(periodId: string): boolean {
    return (this.newCategory.defaultServicePeriodIds || []).includes(periodId);
  }

  getPeriodName(periodId: string): string {
    const period = this.servicePeriods.find(p => p.id === periodId);
    return period ? period.name : periodId;
  }

    onSearch() {
      this.searchTerm$.next(this.searchTerm);
    }

  addNewCategory() {
    this.showAddForm = true;
    this.editingCategory = null;
    this.resetForm();
  }

  editCategory(category: MenuCategory) {
    this.showAddForm = true;
    this.editingCategory = category;
    this.newCategory = { ...category };
  }

  async saveCategory() {
    this.formErrors = {};

    if (!this.newCategory.name?.trim()) {
      this.formErrors['name'] = 'El nombre es obligatorio';
    }

    if (Object.keys(this.formErrors).length > 0) {
      return;
    }

    try {
      console.log('saveCategory called with newCategory:', this.newCategory);
      if (this.editingCategory) {
        await this.categoryService.updateCategory(this.editingCategory.id, this.newCategory);
        console.log('Category updated successfully');
        this.cancelEdit();
      } else {
        const categoryToAdd: Omit<MenuCategory, 'id' | 'createdAt' | 'updatedAt'> = {
          ...this.newCategory,
          name: this.newCategory.name || '',
          active: this.newCategory.active ?? true,
          defaultServicePeriodIds: this.newCategory.defaultServicePeriodIds || []
        };
        console.log('About to create category:', categoryToAdd);
        await this.categoryService.createCategory(categoryToAdd);
        console.log('Category created successfully');
        this.cancelEdit();
      }
    } catch (error) {
      console.error('Error saving category:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al guardar la categoría: ${errorMessage}. Por favor, inténtalo de nuevo.`);
    }
  }

  async deleteCategory(category: MenuCategory) {
    if (confirm(`¿Estás seguro de que quieres eliminar la categoría "${category.name}"?`)) {
      try {
        await this.categoryService.deleteCategory(category.id);
        console.log('Category deleted');
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Error al eliminar la categoría. Por favor, inténtalo de nuevo.');
      }
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingCategory = null;
    this.resetForm();
  }

  private resetForm() {
    this.newCategory = {
      name: '',
      active: true,
      defaultServicePeriodIds: []
    };
    this.formErrors = {};
  }
}