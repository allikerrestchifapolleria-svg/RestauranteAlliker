import { CartService } from './cart';
import { MenuItem } from '../models/menu-item';

const mockItem: MenuItem = {
  id: '1',
  name: 'Ceviche',
  price: 32.00,
  description: 'Pescado fresco marinado',
  categoryId: 'entradas',
  image: '',
  isAvailable: true,
  tags: ['popular'],
  variants: [],
  modifiers: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    service = new CartService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty cart', () => {
    expect(service.getCartItems().length).toBe(0);
    expect(service.getCartItemCount()).toBe(0);
    expect(service.getCartTotal()).toBe(0);
  });

  it('should add item to cart', () => {
    service.addToCart(mockItem);
    const items = service.getCartItems();
    expect(items.length).toBe(1);
    expect(items[0].item).toBe(mockItem);
    expect(items[0].quantity).toBe(1);
  });

  it('should increase quantity when adding same item twice', () => {
    service.addToCart(mockItem);
    service.addToCart(mockItem);
    const items = service.getCartItems();
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(2);
  });

  it('should add as separate entry when adding different items', () => {
    const item2 = { ...mockItem, id: '2', name: 'Lomo Saltado' };
    service.addToCart(mockItem);
    service.addToCart(item2);
    expect(service.getCartItems().length).toBe(2);
  });

  it('should calculate total correctly for single item', () => {
    service.addToCart(mockItem, 3);
    expect(service.getCartTotal()).toBe(96.00);
  });

  it('should calculate total correctly for multiple items', () => {
    service.addToCart(mockItem, 2);
    const item2 = { ...mockItem, id: '2', name: 'Lomo Saltado', price: 28.00 };
    service.addToCart(item2, 3);
    expect(service.getCartTotal()).toBe(32 * 2 + 28 * 3);
  });

  it('should return correct item count', () => {
    service.addToCart(mockItem, 2);
    const item2 = { ...mockItem, id: '2', name: 'Lomo Saltado' };
    service.addToCart(item2, 3);
    expect(service.getCartItemCount()).toBe(5);
  });

  it('should remove item from cart', () => {
    service.addToCart(mockItem);
    service.removeFromCart('1');
    expect(service.getCartItems().length).toBe(0);
  });

  it('should not affect other items when removing one', () => {
    service.addToCart(mockItem);
    const item2 = { ...mockItem, id: '2', name: 'Lomo Saltado' };
    service.addToCart(item2);
    service.removeFromCart('1');
    expect(service.getCartItems().length).toBe(1);
    expect(service.getCartItems()[0].item.id).toBe('2');
  });

  it('should update quantity', () => {
    service.addToCart(mockItem);
    service.updateQuantity('1', 5);
    expect(service.getCartItemCount()).toBe(5);
  });

  it('should remove item when quantity set to 0', () => {
    service.addToCart(mockItem);
    service.updateQuantity('1', 0);
    expect(service.getCartItems().length).toBe(0);
  });

  it('should remove item when quantity set to negative', () => {
    service.addToCart(mockItem);
    service.updateQuantity('1', -3);
    expect(service.getCartItems().length).toBe(0);
  });

  it('should clear cart', () => {
    service.addToCart(mockItem);
    const item2 = { ...mockItem, id: '2', name: 'Lomo Saltado' };
    service.addToCart(item2);
    service.clearCart();
    expect(service.getCartItems().length).toBe(0);
    expect(service.getCartItemCount()).toBe(0);
    expect(service.getCartTotal()).toBe(0);
  });

  it('should add item with quantity 0 when quantity is 0', () => {
    service.addToCart(mockItem, 0);
    expect(service.getCartItems().length).toBe(1);
    expect(service.getCartItems()[0].quantity).toBe(0);
  });

  it('should handle updating non-existent item gracefully', () => {
    service.updateQuantity('non-existent', 5);
    expect(service.getCartItems().length).toBe(0);
  });
});
