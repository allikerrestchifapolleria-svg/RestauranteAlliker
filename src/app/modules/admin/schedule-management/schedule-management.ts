import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { ServicePeriod, RestaurantSchedule, WEEKDAYS } from '../../../models/service-period';

const ICON_OPTIONS = [
  'fas fa-clock',
  'fas fa-utensils',
  'fas fa-drumstick-bite',
  'fas fa-coffee',
  'fas fa-moon',
  'fas fa-sun',
  'fas fa-hamburger',
  'fas fa-fire',
  'fas fa-bread-slice',
];

@Component({
  selector: 'app-schedule-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-management.html',
  styleUrl: './schedule-management.css',
})
export class ScheduleManagement implements OnInit {
  periods$: Observable<ServicePeriod[]> = new Observable<ServicePeriod[]>();
  schedule$: Observable<RestaurantSchedule> = new Observable<RestaurantSchedule>();
  periods: ServicePeriod[] = [];
  weekdays = WEEKDAYS;
  iconOptions = ICON_OPTIONS;

  showForm: boolean = false;
  editingPeriod: ServicePeriod | null = null;
  newPeriod: Partial<ServicePeriod> = this.emptyPeriod();
  formErrors: Record<string, string> = {};

  closedDays: number[] = [];
  closedDates: string[] = [];
  closedMessage: string = '';
  newClosedDate: string = '';
  scheduleDirty: boolean = false;
  savingSchedule: boolean = false;
  savingPeriod: boolean = false;

  successMessage: string = '';
  errorMessage: string = '';

  constructor(
    private availabilityService: MenuAvailabilityService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.periods$ = this.availabilityService.getPeriods();
    this.periods$.subscribe(periods => {
      this.periods = periods;
    });
    this.schedule$ = this.availabilityService.getSchedule();
    this.schedule$.subscribe(schedule => {
      this.closedDays = [...schedule.closedDays];
      this.closedDates = [...(schedule.closedDates || [])];
      this.closedMessage = schedule.closedMessage || '';
    });
  }

  private emptyPeriod(): Partial<ServicePeriod> {
    return {
      name: '',
      days: [],
      startTime: '11:00',
      endTime: '16:00',
      icon: 'fas fa-clock',
      order: 0,
      active: true,
    };
  }

  getDayLabel(value: number): string {
    const day = this.weekdays.find(d => d.value === value);
    return day ? day.label : String(value);
  }

  getPeriodDaysLabel(period: ServicePeriod): string {
    if (!period.days || period.days.length === 0) {
      return 'Sin días';
    }
    const all = this.weekdays.map(d => d.value);
    if (all.every(d => period.days.includes(d))) {
      return 'Todos los días';
    }
    return period.days
      .slice()
      .sort((a, b) => a - b)
      .map(day => this.getDayLabel(day).substring(0, 3))
      .join(', ');
  }

  getPeriodTimeLabel(period: ServicePeriod): string {
    const overnight = this.toMinutes(period.endTime) < this.toMinutes(period.startTime);
    return `${period.startTime} - ${period.endTime}${overnight ? ' (siguiente día)' : ''}`;
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(part => parseInt(part, 10) || 0);
    return h * 60 + m;
  }

  addNewPeriod() {
    this.showForm = true;
    this.editingPeriod = null;
    this.newPeriod = this.emptyPeriod();
    this.formErrors = {};
  }

  editPeriod(period: ServicePeriod) {
    this.showForm = true;
    this.editingPeriod = period;
    this.newPeriod = {
      name: period.name,
      days: [...period.days],
      startTime: period.startTime,
      endTime: period.endTime,
      icon: period.icon,
      order: period.order,
      active: period.active,
    };
    this.formErrors = {};
  }

  cancelForm() {
    this.showForm = false;
    this.editingPeriod = null;
  }

  toggleDayInForm(day: number) {
    const current: number[] = this.newPeriod.days || [];
    const idx = current.indexOf(day);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(day);
    }
    this.newPeriod.days = [...current];
  }

  isDaySelected(day: number): boolean {
    return (this.newPeriod.days || []).includes(day);
  }

  async savePeriod() {
    this.formErrors = {};
    if (!this.newPeriod.name?.trim()) {
      this.formErrors['name'] = 'El nombre es obligatorio';
    }
    if (!this.newPeriod.days || this.newPeriod.days.length === 0) {
      this.formErrors['days'] = 'Selecciona al menos un día';
    }
    if (!this.newPeriod.startTime || !this.newPeriod.endTime) {
      this.formErrors['time'] = 'La hora de inicio y fin son obligatorias';
    }

    if (Object.keys(this.formErrors).length > 0) {
      this.cdr.detectChanges();
      return;
    }

    this.savingPeriod = true;
    this.errorMessage = '';
    try {
      if (this.editingPeriod) {
        await this.availabilityService.updatePeriod(this.editingPeriod.id, {
          name: this.newPeriod.name!.trim(),
          days: this.newPeriod.days!,
          startTime: this.newPeriod.startTime!,
          endTime: this.newPeriod.endTime!,
          icon: this.newPeriod.icon || 'fas fa-clock',
          order: this.newPeriod.order || 0,
          active: this.newPeriod.active ?? true,
        });
        this.successMessage = 'Franja actualizada exitosamente';
      } else {
        await this.availabilityService.addPeriod({
          name: this.newPeriod.name!.trim(),
          days: this.newPeriod.days!,
          startTime: this.newPeriod.startTime!,
          endTime: this.newPeriod.endTime!,
          icon: this.newPeriod.icon || 'fas fa-clock',
          order: this.newPeriod.order || 0,
          active: this.newPeriod.active ?? true,
        });
        this.successMessage = 'Franja creada exitosamente';
      }
      this.cancelForm();
      setTimeout(() => (this.successMessage = ''), 3000);
    } catch (error) {
      console.error('Error guardando franja:', error);
      this.errorMessage = 'Error al guardar la franja';
    } finally {
      this.savingPeriod = false;
      this.cdr.detectChanges();
    }
  }

  deletePeriod(period: ServicePeriod) {
    if (confirm(`¿Estás seguro de que quieres eliminar la franja "${period.name}"?`)) {
      this.availabilityService.deletePeriod(period.id).then(() => {
        this.successMessage = 'Franja eliminada exitosamente';
        setTimeout(() => (this.successMessage = ''), 3000);
      }).catch(error => {
        console.error('Error eliminando franja:', error);
        this.errorMessage = 'Error al eliminar la franja';
      });
    }
  }

  togglePeriodActive(period: ServicePeriod) {
    this.availabilityService.updatePeriod(period.id, { active: !period.active }).then(() => {
      this.successMessage = `Franja ${period.active ? 'deshabilitada' : 'habilitada'} exitosamente`;
      setTimeout(() => (this.successMessage = ''), 3000);
    }).catch(error => {
      console.error('Error actualizando franja:', error);
      this.errorMessage = 'Error al actualizar la franja';
    });
  }

  // ============================================================
  // Horario del local (días de descanso)
  // ============================================================

  isClosedDay(day: number): boolean {
    return this.closedDays.includes(day);
  }

  toggleClosedDay(day: number) {
    const idx = this.closedDays.indexOf(day);
    if (idx >= 0) {
      this.closedDays.splice(idx, 1);
    } else {
      this.closedDays.push(day);
    }
    this.closedDays = [...this.closedDays];
    this.scheduleDirty = true;
  }

  addClosedDate() {
    if (!this.newClosedDate) {
      return;
    }
    if (!this.closedDates.includes(this.newClosedDate)) {
      this.closedDates.push(this.newClosedDate);
      this.closedDates = [...this.closedDates];
      this.scheduleDirty = true;
    }
    this.newClosedDate = '';
  }

  removeClosedDate(date: string) {
    this.closedDates = this.closedDates.filter(d => d !== date);
    this.scheduleDirty = true;
  }

  onMessageChange() {
    this.scheduleDirty = true;
  }

  async saveSchedule() {
    this.savingSchedule = true;
    this.errorMessage = '';
    try {
      await this.availabilityService.updateSchedule({
        closedDays: this.closedDays,
        closedDates: this.closedDates,
        closedMessage: this.closedMessage,
      });
      this.successMessage = 'Horario guardado exitosamente';
      this.scheduleDirty = false;
      setTimeout(() => (this.successMessage = ''), 3000);
    } catch (error) {
      console.error('Error guardando horario:', error);
      this.errorMessage = 'Error al guardar el horario';
    } finally {
      this.savingSchedule = false;
      this.cdr.detectChanges();
    }
  }
}
