import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

// Asegúrate de que las rutas a tus servicios/modelos sean correctas
import { MenuService } from '../../../services/menu';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { MenuCategoryService } from '../../../services/menu-category';
// MODO VITRINA: carrito deshabilitado. Descomentar para reactivar.
// import { CartService } from '../../../services/cart';
// import { CartSidebarService } from '../../../shared/components/cart-sidebar/cart-sidebar.service';
import { MenuItem } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  menuItems$: Observable<MenuItem[]> = new Observable<MenuItem[]>();
  filteredDishes: MenuItem[] = [];
  private allDishes: MenuItem[] = [];
  private categories: MenuCategory[] = [];

  // Estado del buscador
  searchTerm: string = '';
  searchError: string = '';
  isSearching: boolean = false;

  // Formulario Reactivo
  newsletterForm: FormGroup;
  submitted = false;

  constructor(
    private router: Router,
    private menuService: MenuService,
    private availabilityService: MenuAvailabilityService,
    private categoryService: MenuCategoryService,
    // MODO VITRINA: carrito deshabilitado. Descomentar para reactivar.
    // private cartService: CartService,
    // private cartSidebarService: CartSidebarService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.newsletterForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$')
        ]
      ]
    });
  }

  ngOnInit(): void {
    // Simulación: Reemplaza con tu servicio real
    this.menuItems$ = this.menuService.getMenuItems();
    this.availabilityService.startClock();
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.refreshFeaturedDishes();
    });
    this.availabilityService.getPeriods().subscribe(() => this.refreshFeaturedDishes());
    this.availabilityService.getSchedule().subscribe(() => this.refreshFeaturedDishes());
    this.availabilityService.now$.subscribe(() => this.refreshFeaturedDishes());
    this.menuItems$.subscribe(items => {
      this.allDishes = items;
      this.refreshFeaturedDishes();
    });

    this.initScrollAnimations();
  }

  private refreshFeaturedDishes() {
    const available = this.allDishes.filter(item => {
      const category = this.categories.find(c => c.id === item.categoryId);
      return this.availabilityService.isItemAvailable(item, category);
    });
    this.filteredDishes = available.slice(0, 3);
    this.cdr.detectChanges();
  }

  // --- Lógica del Buscador ---
  onSearch(): void {
    this.isSearching = true;

    // MEJORA: Regex actualizado para permitir tildes y ñ (Español)
    // Antes: /^[a-zA-Z0-9\s]*$/
    const validPattern = /^[a-zA-Z0-9\s\u00C0-\u00FF]*$/;

    if (!validPattern.test(this.searchTerm)) {
      this.searchError = 'Por favor, usa solo letras y números.';
      this.isSearching = false;
      return;
    }

    this.searchError = '';

    if (this.searchTerm.trim()) {
      const available = this.allDishes.filter(item => {
        const category = this.categories.find(c => c.id === item.categoryId);
        return this.availabilityService.isItemAvailable(item, category);
      });
      this.filteredDishes = available
        .filter(item =>
          item.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        )
        .slice(0, 3);
    } else {
      this.refreshFeaturedDishes();
    }

    this.isSearching = false;
  }

  // --- Lógica del Formulario ---
  get f() {
    return this.newsletterForm.controls;
  }

  onSubscribe(): void {
    this.submitted = true;

    if (this.newsletterForm.invalid) {
      return;
    }

    // Lógica de suscripción
    console.log('Suscripción exitosa:', this.newsletterForm.value);

    // Podrías usar un Toast service aquí en lugar de alert
    alert('¡Gracias por suscribirte a nuestras novedades culinarias!');

    this.submitted = false;
    this.newsletterForm.reset();
  }

  // --- Navegación ---
  onViewMenu(): void {
    this.router.navigate(['/menu']);
  }

  // RESERVACIONES DESHABILITADO (posible implementación futura).
  // onReserveTable(): void {
  //   this.router.navigate(['/reservations']);
  // }

  // --- Utilidades ---
  // MODO VITRINA: carrito deshabilitado. Descomentar para reactivar.
  // onAddToCart(dish: MenuItem): void {
  //   this.cartService.addToCart(dish);
  // }
  //
  // getCartItemCount(): number {
  //   return this.cartService.getCartItemCount();
  // }
  //
  // openCartSidebar() {
  //   this.cartSidebarService.open();
  // }

  // Asegúrate de que tu modelo MenuItem tenga 'id'. Si no, usa otro campo único.
  trackByDish(index: number, dish: MenuItem): string | number {
    return dish.id;
  }

  private initScrollAnimations(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    setTimeout(() => {
      // Asegúrate de añadir la clase 'animate-on-scroll'
      // en el HTML a los elementos que quieras animar
      const elements = document.querySelectorAll('.animate-on-scroll');
      elements.forEach(el => observer.observe(el));
    }, 100);
  }
}
