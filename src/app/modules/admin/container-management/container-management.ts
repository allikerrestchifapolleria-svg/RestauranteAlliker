import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ContainerService } from '../../../services/container';
import { TakeoutContainer } from '../../../models/container';

@Component({
  selector: 'app-container-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './container-management.html',
  styleUrl: './container-management.css',
})
export class ContainerManagement {
  containers$: Observable<TakeoutContainer[]>;
  filteredContainers$: Observable<TakeoutContainer[]>;
  searchTerm: string = '';
  searchTerm$ = new BehaviorSubject<string>('');

  showAddForm: boolean = false;
  editingContainer: TakeoutContainer | null = null;
  formErrors: Record<string, string> = {};
  isSaving: boolean = false;

  newContainer: Partial<TakeoutContainer> = this.emptyContainer();

  constructor(private containerService: ContainerService) {
    this.containers$ = this.containerService.getContainers();
    this.filteredContainers$ = combineLatest([this.containers$, this.searchTerm$]).pipe(
      map(([containers, term]) =>
        containers.filter(c => c.name.toLowerCase().includes(term.toLowerCase()))
      )
    );
  }

  onSearch() {
    this.searchTerm$.next(this.searchTerm);
  }

  addNewContainer() {
    this.showAddForm = true;
    this.editingContainer = null;
    this.newContainer = this.emptyContainer();
    this.formErrors = {};
  }

  editContainer(container: TakeoutContainer) {
    this.showAddForm = true;
    this.editingContainer = container;
    this.newContainer = { ...container };
    this.formErrors = {};
  }

  async saveContainer() {
    if (this.isSaving) return;
    this.formErrors = {};

    const name = this.newContainer.name?.trim();
    const price = Number(this.newContainer.price);

    if (!name) {
      this.formErrors['name'] = 'El nombre es obligatorio';
    }
    if (isNaN(price) || price < 0) {
      this.formErrors['price'] = 'El precio debe ser 0 o mayor';
    }
    if (Object.keys(this.formErrors).length > 0) return;

    this.isSaving = true;
    try {
      const payload = {
        name: name!,
        price: Math.round(price * 100) / 100,
        description: this.newContainer.description?.trim() || '',
        isDefault: this.newContainer.isDefault ?? false,
        active: this.newContainer.active ?? true
      };

      if (this.editingContainer) {
        await this.containerService.updateContainer(this.editingContainer.id, payload);
      } else {
        await this.containerService.createContainer(payload);
      }

      // Solo un recipiente puede ser el sugerido por defecto.
      if (payload.isDefault) {
        await this.clearOtherDefaults();
      }
      this.cancelEdit();
    } catch (error) {
      console.error('[CONTAINERS] Error guardando recipiente:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert(`No se pudo guardar el recipiente: ${message}`);
    } finally {
      this.isSaving = false;
    }
  }

  private async clearOtherDefaults() {
    const savedName = this.newContainer.name?.trim();
    const duplicates = this.containerService.getActiveContainers()
      .filter(c => c.isDefault && c.name !== savedName);
    for (const c of duplicates) {
      await this.containerService.updateContainer(c.id, { isDefault: false });
    }
  }

  async deleteContainer(container: TakeoutContainer) {
    const confirmed = confirm(
      `¿Eliminar el recipiente "${container.name}"?\n\n` +
      `Las órdenes ya cobradas conservan su recargo; solo dejará de ofrecerse en pedidos nuevos.`
    );
    if (!confirmed) return;

    try {
      await this.containerService.deleteContainer(container.id);
    } catch (error) {
      console.error('[CONTAINERS] Error eliminando recipiente:', error);
      alert('No se pudo eliminar el recipiente. Inténtalo de nuevo.');
    }
  }

  async toggleActive(container: TakeoutContainer) {
    try {
      await this.containerService.updateContainer(container.id, { active: !container.active });
    } catch (error) {
      console.error('[CONTAINERS] Error cambiando estado:', error);
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingContainer = null;
    this.newContainer = this.emptyContainer();
    this.formErrors = {};
  }

  private emptyContainer(): Partial<TakeoutContainer> {
    return { name: '', price: 0, description: '', isDefault: false, active: true };
  }
}
