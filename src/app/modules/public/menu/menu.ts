import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { MenuService } from '../../../services/menu';
import { MenuAvailabilityService } from '../../../services/menu-availability';
// MODO VITRINA: carrito deshabilitado. Descomentar para reactivar.
// import { CartService } from '../../../services/cart';
import { MenuCategoryService } from '../../../services/menu-category';
import { MenuItem, MenuVariant, MenuModifier } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';
// import { CartSidebarService } from '../../../shared/components/cart-sidebar/cart-sidebar.service';

@Component({
  selector: 'app-menu',
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
})
export class Menu implements OnInit {
  menuItems$: Observable<MenuItem[]> = new Observable<MenuItem[]>();
  categories$: Observable<MenuCategory[]> = new Observable<MenuCategory[]>();
  allItems: MenuItem[] = [];
  allCategories: MenuCategory[] = [];
  filteredItems: MenuItem[] = [];
  selectedCategory: string = 'all';
  searchTerm: string = '';
  showAvailableOnly: boolean = false;
  showVegetarianOnly: boolean = false;
  vegetarianCategoryId: string = '';

  showConfigModal = false;
  configItem: MenuItem | null = null;
  selectedVariant: MenuVariant | null = null;
  selectedModifiers: MenuModifier[] = [];
  configQuantity = 1;

  isClosed = false;
  closedMessage = '';

  constructor(
    private menuService: MenuService,
    private availabilityService: MenuAvailabilityService,
    // MODO VITRINA: carrito deshabilitado. Descomentar para reactivar.
    // private cartService: CartService,
    private categoryService: MenuCategoryService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    // private cartSidebarService: CartSidebarService
  ) {}

  ngOnInit() {
    this.menuItems$ = this.menuService.getMenuItems().pipe(startWith([]));
    this.categories$ = this.categoryService.getCategories().pipe(startWith([]));
    this.availabilityService.startClock();

    combineLatest([this.menuItems$, this.categories$]).subscribe(([items, categories]) => {
      this.allItems = items;
      this.allCategories = categories;
      const vegCat = categories.find(c => c.name === 'Vegetarianos');
      this.vegetarianCategoryId = vegCat ? vegCat.id : '';
      this.applyFilters();
      this.cdr.detectChanges();
    });

    this.availabilityService.getPeriods().subscribe(() => {
      this.applyFilters();
      this.cdr.detectChanges();
    });

    this.availabilityService.getSchedule().subscribe(schedule => {
      this.closedMessage = schedule.closedMessage || '';
      this.isClosed = !this.availabilityService.isRestaurantOpen();
      this.applyFilters();
      this.cdr.detectChanges();
    });

    this.availabilityService.now$.subscribe(() => {
      this.isClosed = !this.availabilityService.isRestaurantOpen();
      this.applyFilters();
      this.cdr.detectChanges();
    });
  }

  isItemCurrentlyAvailable(item: MenuItem): boolean {
    const category = this.allCategories.find(c => c.id === item.categoryId);
    return this.availabilityService.isItemAvailable(item, category);
  }

  filterByCategory(categoryId: string) {
    this.selectedCategory = categoryId;
    this.applyFilters();
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredItems = this.allItems.filter(item => {
      const categoryMatch = this.selectedCategory === 'all' ||
        item.categoryId === this.selectedCategory;

      const searchMatch = !this.searchTerm ||
        item.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(this.searchTerm.toLowerCase());

      const availableMatch = !this.showAvailableOnly || this.isItemCurrentlyAvailable(item);

      const vegetarianMatch = !this.showVegetarianOnly ||
        (this.vegetarianCategoryId && item.categoryId === this.vegetarianCategoryId);

      return categoryMatch && searchMatch && availableMatch && vegetarianMatch;
    });
  }

  getItemPeriodLabel(item: MenuItem): string {
    const category = this.allCategories.find(c => c.id === item.categoryId);
    return this.availabilityService.getItemPeriodLabel(item, category);
  }

  getTotalItems(): number {
    return this.allItems.length;
  }

  getCategoryCount(categoryId: string): number {
    return this.allItems.filter(item => item.categoryId === categoryId).length;
  }

  // MODO VITRINA: modal de configuracion y carrito deshabilitados. Descomentar para reactivar.
  // openConfigModal(item: MenuItem) {
  //   this.configItem = item;
  //   this.selectedVariant = null;
  //   this.selectedModifiers = [];
  //   this.configQuantity = 1;
  //   this.showConfigModal = true;
  //   document.body.style.overflow = 'hidden';
  // }
  //
  // closeConfigModal() {
  //   this.showConfigModal = false;
  //   this.configItem = null;
  //   document.body.style.overflow = '';
  // }
  //
  // selectVariant(variant: MenuVariant | null) {
  //   this.selectedVariant = variant;
  // }
  //
  // toggleModifier(modifier: MenuModifier) {
  //   const idx = this.selectedModifiers.findIndex(m => m.name === modifier.name);
  //   if (idx >= 0) {
  //     this.selectedModifiers.splice(idx, 1);
  //   } else {
  //     this.selectedModifiers.push({ ...modifier });
  //   }
  // }
  //
  // isModifierSelected(modifier: MenuModifier): boolean {
  //   return this.selectedModifiers.some(m => m.name === modifier.name);
  // }
  //
  // getConfigBasePrice(): number {
  //   return this.selectedVariant?.price ?? this.configItem?.price ?? 0;
  // }
  //
  // getConfigExtrasTotal(): number {
  //   return this.selectedModifiers.reduce((sum, m) => sum + (m.price || 0), 0);
  // }
  //
  // getConfigTotal(): number {
  //   return (this.getConfigBasePrice() + this.getConfigExtrasTotal()) * this.configQuantity;
  // }
  //
  // confirmAddToCart() {
  //   if (!this.configItem) return;
  //   this.cartService.addToCart(this.configItem, this.configQuantity, this.selectedVariant, this.selectedModifiers);
  //   this.closeConfigModal();
  //   this.cartSidebarService.open();
  // }
  //
  // addToCart(item: MenuItem) {
  //   if (item.variants && item.variants.length > 0) {
  //     this.openConfigModal(item);
  //   } else {
  //     this.cartService.addToCart(item);
  //   }
  // }
  //
  // getCartItemCount(): number {
  //   return this.cartService.getCartItemCount();
  // }
  //
  // getCartTotal(): number {
  //   return this.cartService.getCartTotal();
  // }

  viewItemDetails(item: MenuItem) {
    console.log('Viewing details for:', item.name);
  }

  getCategoryName(categoryId: string): string {
    const category = this.allCategories.find(cat => cat.id === categoryId);
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

  // MODO VITRINA: navegacion a carrito deshabilitada. Descomentar para reactivar.
  // openCartSidebar() {
  //   this.cartSidebarService.open();
  // }
  //
  // goToCart() {
  //   this.router.navigate(['/cart']);
  // }

  // RESERVACIONES DESHABILITADO (posible implementación futura).
  // goToReservations() {
  //   this.router.navigate(['/reservations']);
  // }

  callNow() {
    window.open('tel:+51123456789');
  }
}
