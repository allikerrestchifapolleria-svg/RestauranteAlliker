import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { doc, onSnapshot, Unsubscribe, Firestore } from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { Order } from '../../../models/order';
import { OrdersService } from '../../../services/orders';

@Component({
  selector: 'app-order-tracking',
  imports: [CommonModule, RouterModule],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.css'
})
export class OrderTracking implements OnInit, OnDestroy {
  order: Order | null = null;
  loading = true;
  error = '';
  cancelling = false;
  private unsubscribe: Unsubscribe | null = null;

  statusSteps = [
    { key: 'confirmed', label: 'Confirmado', icon: 'fa-check-circle' },
    { key: 'preparing', label: 'Preparando', icon: 'fa-fire' },
    { key: 'ready', label: 'Listo', icon: 'fa-concierge-bell' },
    { key: 'delivered', label: 'Entregado', icon: 'fa-check-double' },
  ];

  private statusOrder = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ordersService: OrdersService
  ) {}

  ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.error = 'No se especificó un pedido.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.unsubscribe = onSnapshot(
      doc(db, 'orders', orderId),
      (snap) => {
        if (!snap.exists()) {
          this.error = 'Pedido no encontrado.';
          this.loading = false;
          return;
        }
        const data = snap.data();
        this.order = {
          id: snap.id,
          branchId: data['branchId'] || '',
          tableId: data['tableId'] || null,
          customerId: data['customerId'] || null,
          waiterId: data['waiterId'] || undefined,
          waiterName: data['waiterName'] || undefined,
          type: data['type'] || '',
          status: data['status'] || '',
          items: data['items'] || [],
          subtotal: Number(data['subtotal']) || 0,
          tax: Number(data['tax']) || 0,
          total: Number(data['total']) || 0,
          paymentMethod: data['paymentMethod'] || '',
          paymentStatus: data['paymentStatus'] || '',
          notes: data['notes'] || '',
          orderNumber: data['orderNumber'] || undefined,
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
          updatedAt: data['updatedAt']?.toDate ? data['updatedAt'].toDate() : new Date(data['updatedAt'])
        };
        this.loading = false;
      },
      (err) => {
        console.error('[ORDER TRACKING] Error:', err);
        this.error = 'Error al cargar el pedido.';
        this.loading = false;
      }
    );
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  get currentStepIndex(): number {
    if (!this.order) return -1;
    if (this.order.status === 'cancelled') return -1;
    const idx = this.statusOrder.indexOf(this.order.status);
    return idx >= 0 ? idx : -1;
  }

  get isCancelled(): boolean {
    return this.order?.status === 'cancelled';
  }

  get canCancel(): boolean {
    return this.order?.status === 'confirmed';
  }

  get elapsedMinutes(): number {
    if (!this.order || this.order.status !== 'preparing') return 0;
    const elapsed = Date.now() - new Date(this.order.updatedAt).getTime();
    return Math.floor(elapsed / 60000);
  }

  getStatusClass(stepKey: string): string {
    if (!this.order) return '';
    if (this.order.status === 'cancelled') return 'cancelled';
    const stepIdx = this.statusSteps.findIndex(s => s.key === stepKey);
    const currentIdx = this.currentStepIndex;
    if (currentIdx < 0) return '';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  }

  async cancelOrder() {
    if (!this.order || !this.canCancel) return;
    this.cancelling = true;
    try {
      await this.ordersService.updateOrderStatus(this.order.id, 'cancelled');
    } catch (err) {
      console.error('[ORDER TRACKING] Error al cancelar:', err);
    } finally {
      this.cancelling = false;
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
