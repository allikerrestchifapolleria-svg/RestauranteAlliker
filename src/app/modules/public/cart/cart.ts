import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService, CartItem } from '../../../services/cart';
import { BranchService } from '../../../services/branch';
import { Branch } from '../../../models/branch';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart implements OnInit {
  cartItems: CartItem[] = [];
  branches: Branch[] = [];
  selectedBranchId: string = '';
  orderNotes: string = '';
  isUpdating: boolean = false;
  isClearing: boolean = false;
  isProcessing: boolean = false;
  branchDropdownOpen: boolean = false;

  constructor(
    private cartService: CartService,
    private branchService: BranchService,
    private router: Router
  ) {}

  ngOnInit() {
    this.selectedBranchId = this.cartService.branchId;
    this.loadCartItems();
    this.branchService.getBranches().subscribe(branches => {
      this.branches = branches.filter(b => b.status === 'open');
    });
  }

  get selectedBranch(): Branch | undefined {
    return this.branches.find(b => b.id === this.selectedBranchId);
  }

  selectBranch(branchId: string) {
    this.selectedBranchId = branchId;
    this.cartService.branchId = branchId;
    this.branchDropdownOpen = false;
  }

  toggleBranchDropdown() {
    this.branchDropdownOpen = !this.branchDropdownOpen;
  }

  onBranchBlur() {
    setTimeout(() => this.branchDropdownOpen = false, 200);
  }

  private loadCartItems() {
    this.cartItems = this.cartService.getCartItems();
  }

  updateQuantity(index: number, quantity: number) {
    if (this.isUpdating) return;

    this.isUpdating = true;
    this.cartService.updateQuantity(index, quantity);
    this.loadCartItems();

    setTimeout(() => {
      this.isUpdating = false;
    }, 300);
  }

  removeItem(index: number) {
    if (this.isUpdating) return;

    this.isUpdating = true;
    this.cartService.removeCartItem(index);
    this.loadCartItems();

    setTimeout(() => {
      this.isUpdating = false;
    }, 300);
  }

  clearCart() {
    if (this.isClearing) return;

    this.isClearing = true;
    this.cartService.clearCart();
    this.loadCartItems();

    setTimeout(() => {
      this.isClearing = false;
    }, 500);
  }

  getTotal(): number {
    return this.cartService.getCartTotal();
  }

  getSubtotal(): number {
    return this.cartService.getCartTotal();
  }

  getItemPrice(cartItem: CartItem): number {
    return this.cartService.getItemPrice(cartItem);
  }

  getItemSubtotal(cartItem: CartItem): number {
    return this.cartService.getItemSubtotal(cartItem);
  }

  getItemCount(): number {
    return this.cartService.getCartItemCount();
  }

  getServiceFee(): number {
    return 2.00;
  }

  getTagClass(tag: string): string {
    const tagClasses: { [key: string]: string } = {
      'popular': 'badge bg-warning text-dark',
      'spicy': 'badge bg-danger',
      'vegetarian': 'badge bg-success',
      'gluten-free': 'badge bg-info',
      'new': 'badge bg-primary'
    };
    return tagClasses[tag] || 'badge bg-secondary';
  }

  scrollToCheckout() {
    const element = document.getElementById('checkoutSection');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  proceedToCheckout() {
    this.router.navigate(['/payment']);
  }
}
