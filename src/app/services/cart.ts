import { Injectable } from '@angular/core';
import { MenuItem, MenuVariant, MenuModifier } from '../models/menu-item';

export interface CartItem {
  item: MenuItem;
  quantity: number;
  selectedVariant?: MenuVariant | null;
  selectedModifiers?: MenuModifier[];
}

function cartKey(itemId: string, variantName?: string | null, modifierNames?: string): string {
  return `${itemId}|${variantName || ''}|${modifierNames || ''}`;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cart: CartItem[] = [];
  private _branchId: string = '';

  get branchId(): string {
    return this._branchId;
  }

  set branchId(value: string) {
    this._branchId = value;
  }

  addToCart(
    item: MenuItem,
    quantity: number = 1,
    selectedVariant?: MenuVariant | null,
    selectedModifiers?: MenuModifier[]
  ) {
    const modKey = (selectedModifiers || []).map(m => m.name).sort().join(',');
    const key = cartKey(item.id, selectedVariant?.name, modKey);
    const existingItem = this.cart.find(ci =>
      cartKey(ci.item.id, ci.selectedVariant?.name, (ci.selectedModifiers || []).map(m => m.name).sort().join(',')) === key
    );
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.cart.push({ item, quantity, selectedVariant, selectedModifiers: selectedModifiers || [] });
    }
  }

  getItemPrice(cartItem: CartItem): number {
    const base = cartItem.selectedVariant?.price ?? cartItem.item.price;
    const extras = (cartItem.selectedModifiers || []).reduce((sum, m) => sum + (m.price || 0), 0);
    return base + extras;
  }

  getItemSubtotal(cartItem: CartItem): number {
    return this.getItemPrice(cartItem) * cartItem.quantity;
  }

  removeFromCartByKey(key: string) {
    this.cart = this.cart.filter((_, i) => i.toString() !== key);
  }

  removeFromCart(itemId: string) {
    this.cart = this.cart.filter(cartItem => cartItem.item.id !== itemId);
  }

  removeCartItem(index: number) {
    if (index >= 0 && index < this.cart.length) {
      this.cart.splice(index, 1);
    }
  }

  updateQuantity(index: number, quantity: number) {
    if (index >= 0 && index < this.cart.length) {
      if (quantity <= 0) {
        this.cart.splice(index, 1);
      } else {
        this.cart[index].quantity = quantity;
      }
    }
  }

  getCartItems(): CartItem[] {
    return this.cart;
  }

  getCartItemCount(): number {
    return this.cart.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, cartItem) => sum + this.getItemSubtotal(cartItem), 0);
  }

  clearCart() {
    this.cart = [];
  }
}
