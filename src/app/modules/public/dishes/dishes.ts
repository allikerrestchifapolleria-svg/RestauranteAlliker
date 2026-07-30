import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MenuService } from '../../../services/menu';
import { CartService } from '../../../services/cart';
import { MenuItem, MenuVariant, MenuModifier } from '../../../models/menu-item';
import { Router } from '@angular/router';
import { CartSidebarService } from '../../../shared/components/cart-sidebar/cart-sidebar.service';
import { MenuCategoryService } from '../../../services/menu-category';
import { MenuCategory } from '../../../models/menu-category';

@Component({
  selector: 'app-dishes',
  imports: [CommonModule, FormsModule],
  templateUrl: './dishes.html',
  styleUrl: './dishes.css',
})
export class Dishes implements OnInit {
  menuItems$: Observable<MenuItem[]> = new Observable<MenuItem[]>();
  menuItems: MenuItem[] = [];
  filteredItems: MenuItem[] = [];

  categories: MenuCategory[] = [];

  vegetarianCategoryId: string = '';
  selectedCategory = 'all';
  searchTerm = '';
  showAvailableOnly: boolean = false;
  showVegetarianOnly: boolean = false;

  showConfigModal = false;
  configItem: MenuItem | null = null;
  selectedVariant: MenuVariant | null = null;
  selectedModifiers: MenuModifier[] = [];
  configQuantity = 1;

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private router: Router,
    private cartSidebarService: CartSidebarService,
    private categoryService: MenuCategoryService
  ) {}

  ngOnInit() {
    this.menuItems$ = this.menuService.getMenuItems();
    this.menuItems$.subscribe(items => {
      this.menuItems = items;
      this.applyFilters();
    });
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories.filter(cat => cat.active);
      const vegCat = categories.find(c => c.name === 'Vegetarianos');
      this.vegetarianCategoryId = vegCat ? vegCat.id : '';
    });
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value.toLowerCase();
    this.applyFilters();
  }

  filterByCategory(categoryId: string) {
    this.selectedCategory = categoryId;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredItems = this.menuItems.filter(item => {
      const categoryMatch = this.selectedCategory === 'all' || item.categoryId === this.selectedCategory;
      const term = this.searchTerm.toLowerCase();
      const searchMatch = !this.searchTerm ||
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term);
      const availableMatch = !this.showAvailableOnly || item.isAvailable;
      const vegetarianMatch = !this.showVegetarianOnly ||
        (this.vegetarianCategoryId && item.categoryId === this.vegetarianCategoryId);

      return categoryMatch && searchMatch && availableMatch && vegetarianMatch;
    });
  }

  getTotalItems(): number {
    return this.filteredItems.length;
  }

  getCategoryCount(category: string): number {
    return this.filteredItems.filter(item => item.categoryId === category).length;
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
  }

  clearSearch() {
    this.searchTerm = '';
    this.applyFilters();
  }

  clearAllFilters() {
    this.selectedCategory = 'all';
    this.searchTerm = '';
    this.showAvailableOnly = false;
    this.showVegetarianOnly = false;
    this.applyFilters();
  }

  toggleFavorite(item: MenuItem) {
    console.log('Toggling favorite for:', item.name);
  }

  openConfigModal(item: MenuItem) {
    this.configItem = item;
    this.selectedVariant = null;
    this.selectedModifiers = [];
    this.configQuantity = 1;
    this.showConfigModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeConfigModal() {
    this.showConfigModal = false;
    this.configItem = null;
    document.body.style.overflow = '';
  }

  selectVariant(variant: MenuVariant | null) {
    this.selectedVariant = variant;
  }

  toggleModifier(modifier: MenuModifier) {
    const idx = this.selectedModifiers.findIndex(m => m.name === modifier.name);
    if (idx >= 0) {
      this.selectedModifiers.splice(idx, 1);
    } else {
      this.selectedModifiers.push({ ...modifier });
    }
  }

  isModifierSelected(modifier: MenuModifier): boolean {
    return this.selectedModifiers.some(m => m.name === modifier.name);
  }

  getConfigBasePrice(): number {
    return this.selectedVariant?.price ?? this.configItem?.price ?? 0;
  }

  getConfigExtrasTotal(): number {
    return this.selectedModifiers.reduce((sum, m) => sum + (m.price || 0), 0);
  }

  getConfigTotal(): number {
    return (this.getConfigBasePrice() + this.getConfigExtrasTotal()) * this.configQuantity;
  }

  confirmAddToCart() {
    if (!this.configItem) return;
    this.cartService.addToCart(this.configItem, this.configQuantity, this.selectedVariant, this.selectedModifiers);
    this.closeConfigModal();
    this.cartSidebarService.open();
  }

  addToCart(item: MenuItem) {
    if (item.variants && item.variants.length > 0) {
      this.openConfigModal(item);
    } else {
      this.cartService.addToCart(item);
    }
  }

  getCartItemCount(): number {
    return this.cartService.getCartItemCount();
  }

  getCartTotal(): number {
    return this.cartService.getCartTotal();
  }

  openCartSidebar() {
    this.cartSidebarService.open();
  }

  goToReservations() {
    this.router.navigate(['/reservations']);
  }

  callNow() {
    window.location.href = 'tel:+51123456789';
  }
}
