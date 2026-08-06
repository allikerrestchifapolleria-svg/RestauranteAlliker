import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartSidebarService } from './cart-sidebar.service';
import { CartService } from '../../../services/cart';
import { BranchService } from '../../../services/branch';
import { Branch } from '../../../models/branch';

@Component({
  selector: 'app-cart-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-sidebar.html',
  styleUrl: './cart-sidebar.css',
})
export class CartSidebarComponent implements OnInit, OnDestroy {
  visible = false;
  showBranchPicker = false;
  branches: Branch[] = [];
  private sub!: Subscription;
  private branchSub!: Subscription;

  constructor(
    public cartSidebarService: CartSidebarService,
    public cartService: CartService,
    private branchService: BranchService,
    private router: Router
  ) {}

  ngOnInit() {
    this.sub = this.cartSidebarService.isOpen$.subscribe(open => {
      this.visible = open;
      if (!open) {
        this.showBranchPicker = false;
      }
      document.body.style.overflow = open ? 'hidden' : '';
    });
    this.branchSub = this.branchService.getBranches().subscribe(branches => {
      this.branches = branches.filter(b => b.status === 'open');
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.branchSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  close() { this.cartSidebarService.close(); }

  getCartItems() { return this.cartService.getCartItems(); }
  getCartItemCount() { return this.cartService.getCartItemCount(); }
  getCartTotal() { return this.cartService.getCartTotal(); }
  getItemPrice(cartItem: any) { return this.cartService.getItemPrice(cartItem); }
  getItemSubtotal(cartItem: any) { return this.cartService.getItemSubtotal(cartItem); }

  updateQuantity(index: number, qty: number) {
    this.cartService.updateQuantity(index, qty);
  }

  removeItem(index: number) {
    this.cartService.removeCartItem(index);
  }

  goToCart() {
    this.close();
    this.router.navigate(['/cart']);
  }

  goToPayment() {
    if (!this.cartService.branchId) {
      this.showBranchPicker = true;
      return;
    }
    this.close();
    this.router.navigate(['/payment']).catch(err => {
      console.error('[CartSidebar] Navigation error:', err);
    });
  }

  selectBranch(branchId: string) {
    this.cartService.branchId = branchId;
    this.showBranchPicker = false;
    this.close();
    this.router.navigate(['/payment']).catch(err => {
      console.error('[CartSidebar] Navigation error:', err);
    });
  }

  cancelBranchSelection() {
    this.showBranchPicker = false;
  }
}
