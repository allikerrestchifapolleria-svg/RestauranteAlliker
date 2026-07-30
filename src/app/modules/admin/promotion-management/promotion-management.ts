import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { PromotionsService } from '../../../services/promotions';
import { ImageUploadService } from '../../../services/image-upload';
import { Promotion } from '../../../models/promotion';

@Component({
  selector: 'app-promotion-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './promotion-management.html',
  styleUrl: './promotion-management.css',
})
export class PromotionManagement implements OnInit {
  promotions$: Observable<Promotion[]> = new Observable<Promotion[]>();
  searchTerm: string = '';
  searchTerm$ = new BehaviorSubject<string>('');
  filteredPromotions$: Observable<Promotion[]>;
  showAddForm: boolean = false;
  editingPromotion: Promotion | null = null;

  // Form data
  newPromotion: Partial<Promotion> = {
    title: '',
    description: '',
    discountPercentage: 5,
    type: 'porcentaje',
    active: true,
    appliesTo: {},
    validDays: [],
    validHours: { start: '12', end: '22' },
    image: ''
  };

  // Helper properties for form
  validDaysString: string = '';
  validHoursStart: string = '12';
  validHoursEnd: string = '22';
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;
  formErrors: Record<string, string> = {};

  constructor(
    private promotionsService: PromotionsService,
    private imageUploadService: ImageUploadService
  ) {
    this.promotions$ = this.promotionsService.getPromotions();
    this.filteredPromotions$ = combineLatest([this.promotions$, this.searchTerm$]).pipe(
      map(([promotions, term]) =>
        promotions.filter(promotion => {
          const title = promotion.title?.toLowerCase() || '';
          const description = promotion.description?.toLowerCase() || '';
          const type = promotion.type?.toLowerCase() || '';
          return title.includes(term.toLowerCase()) ||
                 description.includes(term.toLowerCase()) ||
                 type.includes(term.toLowerCase());
        })
      )
    );
  }

  ngOnInit() {
    // No need to subscribe manually, using async pipe in template
  }

  onSearch() {
    // Emit the current search term to trigger filtering
    this.searchTerm$.next(this.searchTerm);
  }

  addNewPromotion() {
    this.showAddForm = true;
    this.editingPromotion = null;
    this.resetForm();
  }

  editPromotion(promotion: Promotion) {
    this.showAddForm = true;
    this.editingPromotion = promotion;
    this.newPromotion = { ...promotion };
    // Convert arrays to strings for form
    this.validDaysString = promotion.validDays ? promotion.validDays.join(', ') : '';
    this.validHoursStart = promotion.validHours?.start || '12';
    this.validHoursEnd = promotion.validHours?.end || '22';
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }

    this.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async savePromotion() {
    this.formErrors = {};

    if (!this.newPromotion.title?.trim()) {
      this.formErrors['title'] = 'El título es obligatorio';
    }
    if (!this.newPromotion.description?.trim()) {
      this.formErrors['description'] = 'La descripción es obligatoria';
    }
    const discount = Number(this.newPromotion.discountPercentage);
    if (discount == null || isNaN(discount) || discount < 0 || discount > 100) {
      this.formErrors['discountPercentage'] = 'Ingrese un porcentaje válido (0-100)';
    }

    if (Object.keys(this.formErrors).length > 0) {
      return;
    }

    try {
      if (this.selectedImageFile) {
        this.newPromotion.image = await this.imageUploadService.uploadImage(this.selectedImageFile, 'promotions');
      }

      const validDays = this.validDaysString ? this.validDaysString.split(',').map(day => day.trim()).filter(day => day) : [];

      const promotionData = {
        ...this.newPromotion,
        validDays: validDays
      };

      if (this.editingPromotion) {
        console.log('Updating promotion:', promotionData);
        await this.promotionsService.updatePromotion(this.editingPromotion.id, promotionData);
        this.cancelEdit();
      } else {
        const promotionToAdd: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'> = {
          active: this.newPromotion.active || true,
          appliesTo: this.newPromotion.appliesTo || {},
          description: this.newPromotion.description || '',
          discountPercentage: this.newPromotion.discountPercentage || 0,
          image: this.newPromotion.image || '',
          title: this.newPromotion.title || '',
          type: this.newPromotion.type || 'porcentaje',
          validDays: validDays,
          validHours: { start: this.validHoursStart, end: this.validHoursEnd }
        };
        console.log('Adding promotion:', promotionToAdd);
        await this.promotionsService.createPromotion(promotionToAdd);
        this.cancelEdit();
      }
    } catch (error) {
      console.error('Error saving promotion:', error);
      alert('Error al guardar la promoción. Por favor, inténtalo de nuevo.');
    }
  }

  deletePromotion(promotion: Promotion) {
    if (confirm(`¿Estás seguro de que quieres eliminar la promoción "${promotion.title}"?`)) {
      this.promotionsService.deletePromotion(promotion.id).then(() => {
        console.log('Promotion deleted');
      });
    }
  }

  togglePromotionStatus(promotion: Promotion) {
    this.promotionsService.togglePromotionStatus(promotion.id).then(() => {
      console.log('Promotion status toggled');
    });
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingPromotion = null;
    this.resetForm();
  }

  private resetForm() {
    this.newPromotion = {
      title: '',
      description: '',
      discountPercentage: 5,
      type: 'porcentaje',
      active: true,
      appliesTo: {},
      validDays: [],
      validHours: { start: '12', end: '22' },
    image: ''
  };
    this.validDaysString = '';
    this.validHoursStart = '12';
    this.validHoursEnd = '22';
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
    this.formErrors = {};
  }

  adjustNumericField(target: any, key: string, delta: number, min: number = 0, max: number = Infinity) {
    const current = Number(target[key]) || 0;
    target[key] = Math.min(max, Math.max(min, current + delta));
  }
}