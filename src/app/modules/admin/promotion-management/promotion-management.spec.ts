import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PromotionManagement } from './promotion-management';
import { PromotionsService } from '../../../services/promotions';
import { of } from 'rxjs';
import { Promotion } from '../../../models/promotion';

const now = new Date();
const mockPromotions: Promotion[] = [
  { id: 'p1', title: 'Descuento Ceviche', description: '20% en ceviche', discountPercentage: 20, type: 'porcentaje', active: true, appliesTo: {}, validDays: ['lunes', 'martes'], validHours: { start: '12', end: '22' }, image: '', createdAt: now, updatedAt: now },
  { id: 'p2', title: '2x1 Lomo', description: 'Lleva 2 lomos al precio de 1', discountPercentage: 50, type: 'porcentaje', active: false, appliesTo: {}, validDays: [], validHours: { start: '12', end: '22' }, image: '', createdAt: now, updatedAt: now },
];

describe('PromotionManagement', () => {
  let component: PromotionManagement;
  let fixture: ComponentFixture<PromotionManagement>;
  let promotionsServiceSpy: jasmine.SpyObj<PromotionsService>;

  beforeEach(async () => {
    promotionsServiceSpy = jasmine.createSpyObj('PromotionsService', ['getPromotions', 'createPromotion', 'updatePromotion', 'deletePromotion', 'togglePromotionStatus']);
    promotionsServiceSpy.getPromotions.and.returnValue(of(mockPromotions));

    await TestBed.configureTestingModule({
      imports: [PromotionManagement],
      providers: [
        { provide: PromotionsService, useValue: promotionsServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PromotionManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load promotions on init', () => {
    expect(promotionsServiceSpy.getPromotions).toHaveBeenCalled();
  });

  it('should filter promotions by search', () => {
    component.searchTerm = 'Ceviche';
    component.onSearch();
    expect(component.filteredPromotions$).toBeTruthy();
  });

  it('should open add form', () => {
    component.addNewPromotion();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingPromotion).toBeNull();
  });

  it('should edit promotion', () => {
    component.editPromotion(mockPromotions[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingPromotion?.id).toBe('p1');
    expect(component.validDaysString).toBe('lunes, martes');
  });

  it('should create new promotion', async () => {
    promotionsServiceSpy.createPromotion.and.returnValue(Promise.resolve());
    component.newPromotion.title = 'Nueva Promo';
    component.newPromotion.description = 'Desc';
    component.newPromotion.discountPercentage = 10;
    await component.savePromotion();
    expect(promotionsServiceSpy.createPromotion).toHaveBeenCalled();
  });

  it('should update existing promotion', async () => {
    promotionsServiceSpy.updatePromotion.and.returnValue(Promise.resolve());
    component.editingPromotion = mockPromotions[0];
    component.newPromotion = { ...mockPromotions[0] };
    await component.savePromotion();
    expect(promotionsServiceSpy.updatePromotion).toHaveBeenCalled();
  });

  it('should cancel edit', () => {
    component.showAddForm = true;
    component.editingPromotion = mockPromotions[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingPromotion).toBeNull();
  });

  it('should toggle promotion status', (done) => {
    promotionsServiceSpy.togglePromotionStatus.and.returnValue(Promise.resolve());
    component.togglePromotionStatus(mockPromotions[0]);

    setTimeout(() => {
      expect(promotionsServiceSpy.togglePromotionStatus).toHaveBeenCalledWith('p1');
      done();
    }, 100);
  });

  it('should have default values on init', () => {
    expect(component.newPromotion.discountPercentage).toBe(5);
    expect(component.newPromotion.type).toBe('porcentaje');
    expect(component.newPromotion.active).toBeTrue();
  });
});
