import { Component, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { MenuService } from '../../../services/menu';
import { MenuCategoryService } from '../../../services/menu-category';
import { ImageUploadService } from '../../../services/image-upload';
import { MenuItem, MenuVariant, MenuModifier } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';

@Component({
  selector: 'app-menu-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-management.html',
  styleUrl: './menu-management.css',
})
export class MenuManagement implements OnInit {
  menuItems$: Observable<MenuItem[]> = new Observable<MenuItem[]>();
  selectedCategory: string = 'all';
  searchTerm: string = '';
  selectedCategory$ = new BehaviorSubject<string>('all');
  searchTerm$ = new BehaviorSubject<string>('');
  filteredItems$: Observable<MenuItem[]>;
  showAddForm: boolean = false;
  editingItem: MenuItem | null = null;
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  categories: MenuCategory[] = [];
  categoryDropdownOpen: boolean = false;

  newItem: Partial<MenuItem> = {
    name: '',
    description: '',
    price: 0,
    image: '',
    categoryId: '',
    isAvailable: true,
    tags: [],
    variants: [],
    modifiers: []
  };

  tagsString: string = '';
  formVariants: MenuVariant[] = [];
  formModifiers: MenuModifier[] = [];
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;
  formErrors: Record<string, string> = {};

  constructor(
    private menuService: MenuService,
    private categoryService: MenuCategoryService,
    private imageUploadService: ImageUploadService,
    private elementRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef
  ) {
    this.menuItems$ = this.menuService.getMenuItems();
    this.filteredItems$ = combineLatest([this.menuItems$, this.selectedCategory$, this.searchTerm$]).pipe(
      map(([items, category, term]) =>
        items.filter(item => {
          const matchesCategory = category === 'all' || item.categoryId === category;
          const matchesSearch = item.name.toLowerCase().includes(term.toLowerCase()) ||
                                item.description.toLowerCase().includes(term.toLowerCase());
          return matchesCategory && matchesSearch;
        })
      )
    );
  }

  ngOnInit() {
    this.categoryService.getCategories().subscribe(categories => {
      console.log('MenuManagement: Loaded categories from service:', categories);
      this.categories = categories.filter(cat => cat.active);
      console.log('MenuManagement: Filtered active categories:', this.categories);
    });
  }

  onSearch() {
    this.searchTerm$.next(this.searchTerm);
  }

  filterByCategory(categoryId: string) {
    this.selectedCategory = categoryId;
    this.selectedCategory$.next(categoryId);
  }

  toggleCategoryDropdown() {
    this.categoryDropdownOpen = !this.categoryDropdownOpen;
    if (this.categoryDropdownOpen) {
      this.focusSelectedCategoryOption();
    }
  }

  closeCategoryDropdown() {
    this.categoryDropdownOpen = false;
  }

  onCategoryToggleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.categoryDropdownOpen) {
        this.categoryDropdownOpen = true;
      }
      this.focusSelectedCategoryOption();
    } else if (event.key === 'Escape') {
      this.closeCategoryDropdown();
    }
  }

  private focusSelectedCategoryOption() {
    setTimeout(() => {
      const selected = this.elementRef.nativeElement.querySelector<HTMLElement>(
        '.category-dropdown-option[aria-selected="true"]'
      );
      const fallback = this.elementRef.nativeElement.querySelector<HTMLElement>('.category-dropdown-option');
      (selected || fallback)?.focus();
    });
  }

  selectCategoryFilter(categoryId: string) {
    this.filterByCategory(categoryId);
    this.closeCategoryDropdown();
  }

  getSelectedCategoryLabel(): string {
    return this.selectedCategory === 'all' ? 'Todos' : this.getCategoryName(this.selectedCategory);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.categoryDropdownOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeCategoryDropdown();
    }
  }

  onCategoryOptionKeydown(event: KeyboardEvent, categoryId: string) {
    const options = Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.category-dropdown-option')
    );
    const currentIndex = options.indexOf(event.target as HTMLElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        options[(currentIndex + 1) % options.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        options[(currentIndex - 1 + options.length) % options.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        options[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        options[options.length - 1]?.focus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectCategoryFilter(categoryId);
        break;
      case 'Escape':
        event.preventDefault();
        this.closeCategoryDropdown();
        break;
    }
  }

  addNewItem() {
    this.showAddForm = true;
    this.editingItem = null;
    this.resetForm();
  }

  editItem(item: MenuItem) {
    this.showAddForm = true;
    this.editingItem = item;
    this.newItem = { ...item };
    this.tagsString = item.tags ? item.tags.join(', ') : '';
    this.formVariants = item.variants ? item.variants.map(v => ({ ...v })) : [];
    this.formModifiers = item.modifiers ? item.modifiers.map(m => ({ ...m })) : [];
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
  }

  addVariant() {
    this.formVariants.push({ name: '', price: 0 });
  }

  removeVariant(index: number) {
    this.formVariants.splice(index, 1);
  }

  addModifier() {
    this.formModifiers.push({ name: '', price: 0 });
  }

  removeModifier(index: number) {
    this.formModifiers.splice(index, 1);
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }

    this.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreviewUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  async saveItem() {
    console.log('[SAVE-ITEM] saveItem() invoked. editingItem =', this.editingItem?.id ?? null, 'selectedImageFile =', this.selectedImageFile?.name ?? null);
    console.log('[SAVE-ITEM] newItem snapshot =', JSON.parse(JSON.stringify(this.newItem)));

    this.formErrors = {};
    this.errorMessage = '';

    if (!this.newItem.name?.trim()) {
      this.formErrors['name'] = 'El nombre es obligatorio';
    }
    if (this.newItem.price === undefined || this.newItem.price === null || this.newItem.price <= 0) {
      this.formErrors['price'] = 'El precio es obligatorio y debe ser mayor a 0';
    }
    if (!this.newItem.categoryId) {
      this.formErrors['categoryId'] = 'La categoría es obligatoria';
    }

    if (Object.keys(this.formErrors).length > 0) {
      console.warn('[SAVE-ITEM] validation errors:', this.formErrors);
      this.cdr.detectChanges();
      return;
    }
    console.log('[SAVE-ITEM] validation passed');

    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.cdr.detectChanges();

    if (this.selectedImageFile) {
      console.log('[SAVE-ITEM] image present, calling imageUploadService.uploadImage()...');
      try {
        this.newItem.image = await this.imageUploadService.uploadImage(this.selectedImageFile, 'menu_items');
        console.log('[SAVE-ITEM] image upload finished, url =', this.newItem.image);
      } catch (error) {
        console.error('[SAVE-ITEM] Error uploading image:', error);
        this.errorMessage = error instanceof Error ? error.message : 'Error al subir la imagen';
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }
    } else {
      console.log('[SAVE-ITEM] no image selected, skipping upload');
    }

    const tags = this.tagsString ? this.tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const variants = this.formVariants.filter(v => v.name.trim());
    const modifiers = this.formModifiers.filter(m => m.name.trim());

    if (this.editingItem) {
      console.log('[SAVE-ITEM] updating existing item', this.editingItem.id);
      this.menuService.updateMenuItem(this.editingItem.id, {
        ...this.newItem,
        tags,
        variants,
        modifiers
      }).then(() => {
        console.log('[SAVE-ITEM] updateMenuItem resolved OK');
        this.successMessage = 'Plato actualizado exitosamente';
        this.cancelEdit();
        setTimeout(() => this.successMessage = '', 3000);
      }).catch((error) => {
        console.error('[SAVE-ITEM] Error updating item:', error);
        this.errorMessage = 'Error al actualizar el plato';
      }).finally(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    } else {
      const itemToAdd = {
        categoryId: this.newItem.categoryId!,
        name: this.newItem.name!,
        description: this.newItem.description!,
        price: this.newItem.price!,
        image: this.newItem.image || '',
        tags,
        variants,
        modifiers,
        isAvailable: this.newItem.isAvailable ?? true
      };
      console.log('[SAVE-ITEM] adding new item', itemToAdd);
      this.menuService.addMenuItem(itemToAdd).then((id) => {
        console.log('[SAVE-ITEM] addMenuItem resolved OK, id =', id);
        this.successMessage = 'Plato agregado exitosamente';
        this.cancelEdit();
        setTimeout(() => this.successMessage = '', 3000);
      }).catch((error) => {
        console.error('[SAVE-ITEM] Error adding item:', error);
        this.errorMessage = 'Error al agregar el plato';
      }).finally(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  deleteItem(item: MenuItem) {
    if (confirm(`¿Estás seguro de que quieres eliminar "${item.name}"?`)) {
      this.menuService.deleteMenuItem(item.id).then(() => {
        this.successMessage = 'Plato eliminado exitosamente';
        setTimeout(() => this.successMessage = '', 3000);
      }).catch((error) => {
        console.error('Error deleting item:', error);
        this.errorMessage = 'Error al eliminar el plato';
      });
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingItem = null;
    this.resetForm();
  }

  private resetForm() {
    this.newItem = {
      name: '',
      description: '',
      price: 0,
      image: '',
      categoryId: '',
      isAvailable: true,
      tags: [],
      variants: [],
      modifiers: []
    };
    this.tagsString = '';
    this.formVariants = [];
    this.formModifiers = [];
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
    this.formErrors = {};
  }

  toggleAvailability(item: MenuItem) {
    const newAvailability = !item.isAvailable;
    this.menuService.updateMenuItem(item.id, { isAvailable: newAvailability }).then(() => {
      item.isAvailable = newAvailability;
      this.successMessage = `Plato ${newAvailability ? 'habilitado' : 'deshabilitado'} exitosamente`;
      setTimeout(() => this.successMessage = '', 3000);
    }).catch((error) => {
      console.error('Error updating availability:', error);
      this.errorMessage = 'Error al actualizar disponibilidad';
    });
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  }

  adjustNumericField(target: any, key: string, delta: number, min: number = 0) {
    const current = Number(target[key]) || 0;
    target[key] = Math.round(Math.max(min, current + delta) * 100) / 100;
  }
}
