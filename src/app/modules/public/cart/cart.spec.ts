import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Cart } from './cart';
import { CartService, CartItem } from '../../../services/cart';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { MenuItem } from '../../../models/menu-item';

const mockItem: MenuItem = {
  id: '1', name: 'Ceviche', price: 32, description: 'Pescado fresco',
  categoryId: 'entradas', image: '', isAvailable: true,
  tags: ['popular'], variants: [], modifiers: [],
  createdAt: new Date(), updatedAt: new Date(),
};

const mockItem2: MenuItem = {
  id: '2', name: 'Lomo Saltado', price: 28, description: 'Saltado de lomo',
  categoryId: 'principales', image: '', isAvailable: true,
  tags: [], variants: [], modifiers: [],
  createdAt: new Date(), updatedAt: new Date(),
};

function createCartItem(item: MenuItem, quantity: number): CartItem {
  return { item, quantity };
}

describe('Cart Component', () => {
  let component: Cart;
  let fixture: ComponentFixture<Cart>;
  let cartService: CartService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cart],
      providers: [
        CartService,
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Cart);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    cartService.clearCart();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load cart items on init', () => {
    cartService.addToCart(mockItem, 2);
    component.ngOnInit();
    expect(component.cartItems.length).toBe(1);
    expect(component.cartItems[0].quantity).toBe(2);
  });

  it('should show empty cart when no items', () => {
    component.ngOnInit();
    expect(component.cartItems.length).toBe(0);
    expect(component.getItemCount()).toBe(0);
  });

  it('should update quantity', () => {
    cartService.addToCart(mockItem);
    component.ngOnInit();

    component.updateQuantity('1', 5);
    expect(component.cartItems[0].quantity).toBe(5);
    expect(component.getItemCount()).toBe(5);
  });

  it('should remove item when quantity set to 0', () => {
    cartService.addToCart(mockItem);
    cartService.addToCart(mockItem2);
    component.ngOnInit();

    component.updateQuantity('1', 0);
    expect(component.cartItems.length).toBe(1);
    expect(component.cartItems[0].item.id).toBe('2');
  });

  it('should remove item', () => {
    cartService.addToCart(mockItem);
    cartService.addToCart(mockItem2);
    component.ngOnInit();

    component.removeItem('1');
    expect(component.cartItems.length).toBe(1);
  });

  it('should clear cart', () => {
    cartService.addToCart(mockItem);
    cartService.addToCart(mockItem2);
    component.ngOnInit();

    component.clearCart();
    expect(component.cartItems.length).toBe(0);
    expect(component.getItemCount()).toBe(0);
  });

  it('should calculate total', () => {
    cartService.addToCart(mockItem, 2);
    cartService.addToCart(mockItem2, 3);
    component.ngOnInit();

    const expected = 32 * 2 + 28 * 3;
    expect(component.getTotal()).toBe(expected);
    expect(component.getSubtotal()).toBe(expected);
  });

  it('should calculate delivery fee (free for pickup)', () => {
    component.deliveryType = 'pickup';
    expect(component.getDeliveryFee()).toBe(0);
  });

  it('should calculate delivery fee (5 for delivery)', () => {
    component.deliveryType = 'delivery';
    expect(component.getDeliveryFee()).toBe(5.00);
  });

  it('should have fixed service fee of 2.00', () => {
    expect(component.getServiceFee()).toBe(2.00);
  });

  it('should return tag class for known tags', () => {
    expect(component.getTagClass('popular')).toContain('bg-warning');
    expect(component.getTagClass('spicy')).toContain('bg-danger');
    expect(component.getTagClass('vegetarian')).toContain('bg-success');
    expect(component.getTagClass('gluten-free')).toContain('bg-info');
    expect(component.getTagClass('new')).toContain('bg-primary');
  });

  it('should return default tag class for unknown tags', () => {
    expect(component.getTagClass('unknown')).toContain('bg-secondary');
  });

  it('should navigate to payment on proceedToCheckout', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.proceedToCheckout();
    expect(navigateSpy).toHaveBeenCalledWith(['/payment']);
  });

  it('should handle scrollToCheckout without error', () => {
    expect(() => component.scrollToCheckout()).not.toThrow();
  });

  it('should block rapid quantity updates', () => {
    cartService.addToCart(mockItem);
    component.ngOnInit();

    component.updateQuantity('1', 5);
    component.updateQuantity('1', 3);
    expect(component.cartItems[0].quantity).toBe(5);
  });

  it('should prepopulate deliveryType as pickup', () => {
    expect(component.deliveryType).toBe('pickup');
  });
});
