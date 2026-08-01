/* MODO VITRINA: flujo de pago deshabilitado. Descomentar para reactivar los tests de pago.
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Payment } from './payment';
import { CartService } from '../../../services/cart';
import { PaymentService } from '../../../services/payment';
import { CulqiService } from '../../../services/culqi';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { MenuItem } from '../../../models/menu-item';

const mockItem: MenuItem = {
  id: '1', name: 'Ceviche', price: 32, description: 'Pescado fresco',
  categoryId: 'entradas', image: '', isAvailable: true,
  tags: ['popular'], variants: [], modifiers: [],
  createdAt: new Date(), updatedAt: new Date(),
};

describe('Payment Component', () => {
  let component: Payment;
  let fixture: ComponentFixture<Payment>;
  let cartService: CartService;
  let paymentService: PaymentService;
  let culqiServiceSpy: jasmine.SpyObj<CulqiService>;
  let router: Router;

  beforeEach(async () => {
    culqiServiceSpy = jasmine.createSpyObj('CulqiService', ['openCheckout']);

    await TestBed.configureTestingModule({
      imports: [Payment],
      providers: [
        CartService,
        PaymentService,
        { provide: CulqiService, useValue: culqiServiceSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Payment);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    paymentService = TestBed.inject(PaymentService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    cartService.clearCart();
  });

  it('should create', () => {
    component.ngOnInit();
    expect(component).toBeTruthy();
  });

  it('should load cart items on init', () => {
    cartService.addToCart(mockItem, 2);
    component.ngOnInit();
    expect(component.cartItems.length).toBe(1);
    expect(component.cartItems[0].quantity).toBe(2);
  });

  it('should navigate to menu if cart is empty', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.ngOnInit();
    expect(navigateSpy).toHaveBeenCalledWith(['/menu']);
  });

  it('should default with no payment method selected', () => {
    cartService.addToCart(mockItem);
    component.ngOnInit();
    expect(component.selectedMethod).toBeNull();
  });

  it('should have 3 payment methods', () => {
    expect(component.paymentMethods.length).toBe(3);
    expect(component.paymentMethods).toContain('card');
    expect(component.paymentMethods).toContain('yape');
    expect(component.paymentMethods).toContain('cash');
  });

  it('should select payment method', () => {
    component.selectPaymentMethod('card');
    expect(component.selectedMethod).toBe('card');
  });

  it('should clear error when selecting method', () => {
    component.errorMessage = 'some error';
    component.selectPaymentMethod('yape');
    expect(component.errorMessage).toBe('');
  });

  it('should reset payment data when switching methods', () => {
    component.selectPaymentMethod('card');
    component.yapeCode = 'ABC123';
    component.cashReceived = 50;
    component.cashChange = 10;

    component.selectPaymentMethod('yape');
    expect(component.yapeCode).toBe('');
    expect(component.cashReceived).toBeNull();
    expect(component.cashChange).toBe(0);
  });

  it('should reset cardPaymentProcessed when switching methods', () => {
    component.cardPaymentProcessed = true;
    component.selectPaymentMethod('yape');
    expect(component.cardPaymentProcessed).toBeFalse();
  });

  it('should calculate subtotal correctly', () => {
    cartService.addToCart(mockItem, 3);
    component.ngOnInit();
    expect(component.calculateSubtotal()).toBe(96);
  });

  it('should calculate tax as 18% of subtotal', () => {
    cartService.addToCart(mockItem, 2);
    component.ngOnInit();
    const subtotal = component.calculateSubtotal();
    expect(component.calculateTax()).toBeCloseTo(subtotal * 0.18, 2);
  });

  it('should calculate total as subtotal + tax', () => {
    cartService.addToCart(mockItem);
    component.ngOnInit();
    const total = component.calculateTotal();
    expect(total).toBeCloseTo(32 + 32 * 0.18, 2);
  });

  describe('Card payment (Culqi)', () => {
    beforeEach(() => {
      cartService.addToCart(mockItem);
      component.ngOnInit();
      component.selectPaymentMethod('card');
    });

    it('should allow card payment (Culqi handles validation)', () => {
      expect(component.canProcessPayment()).toBeTrue();
    });

    it('should mark cardPaymentProcessed as false on select', () => {
      expect(component.cardPaymentProcessed).toBeFalse();
    });
  });

  describe('Yape/Plin validation', () => {
    beforeEach(() => {
      cartService.addToCart(mockItem);
      component.ngOnInit();
      component.selectPaymentMethod('yape');
    });

    it('should allow yape payment when cart has items', () => {
      expect(component.canProcessPayment()).toBeTrue();
    });

    it('should set a yape confirmation code for submit', () => {
      component.yapeCode = 'ABC';
      expect(component.yapeCode).toBe('ABC');
    });
  });

  describe('Cash validation', () => {
    beforeEach(() => {
      cartService.addToCart(mockItem);
      component.ngOnInit();
      component.selectPaymentMethod('cash');
    });

    it('should reject null cash received', () => {
      component.cashReceived = null;
      expect(component.canProcessPayment()).toBeFalse();
    });

    it('should reject insufficient cash', () => {
      component.cashReceived = 10;
      expect(component.canProcessPayment()).toBeFalse();
    });

    it('should accept exact cash', () => {
      const total = component.calculateTotal();
      component.cashReceived = total;
      expect(component.canProcessPayment()).toBeTrue();
    });

    it('should accept cash with change', () => {
      const total = component.calculateTotal();
      component.cashReceived = total + 10;
      expect(component.canProcessPayment()).toBeTrue();
    });

    it('should calculate change correctly', () => {
      const total = component.calculateTotal();
      component.cashReceived = total + 20;
      component.onCashReceivedInput();
      expect(component.cashChange).toBeCloseTo(20, 2);
    });

    it('should return 0 change when cash equals total', () => {
      const total = component.calculateTotal();
      component.cashReceived = total;
      component.onCashReceivedInput();
      expect(component.cashChange).toBe(0);
    });
  });

  describe('goBack / goHome navigation', () => {
    beforeEach(() => {
      cartService.addToCart(mockItem);
      component.ngOnInit();
    });

    it('should navigate back to cart', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.goBack();
      expect(navigateSpy).toHaveBeenCalledWith(['/cart']);
    });

    it('should navigate home', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.goHome();
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });
  });

  it('should calculate getItemCount correctly', () => {
    cartService.addToCart(mockItem, 4);
    component.ngOnInit();
    expect(component.getItemCount()).toBe(4);
  });

  it('should have method labels', () => {
    expect(component.methodLabels['card']).toBe('Tarjeta (Culqi)');
    expect(component.methodLabels['yape']).toBe('Yape');
    expect(component.methodLabels['cash']).toBe('Efectivo');
  });
});
*/
