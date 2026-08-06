import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduleManagement } from './schedule-management';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { of } from 'rxjs';
import { ServicePeriod, RestaurantSchedule } from '../../../models/service-period';

const mockPeriods: ServicePeriod[] = [
  {
    id: 'p1', name: 'Menú Mediodía', days: [1, 2, 3, 4, 5], startTime: '11:00', endTime: '16:00',
    icon: 'fas fa-clock', order: 1, active: true, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    id: 'p2', name: 'Pollería Noche', days: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '01:00',
    icon: 'fas fa-moon', order: 2, active: true, createdAt: new Date(), updatedAt: new Date(),
  },
];

const mockSchedule: RestaurantSchedule = {
  closedDays: [2],
  closedDates: [],
  closedMessage: 'Hoy es nuestro día de descanso',
};

describe('ScheduleManagement', () => {
  let component: ScheduleManagement;
  let fixture: ComponentFixture<ScheduleManagement>;
  let availabilityServiceSpy: jasmine.SpyObj<MenuAvailabilityService>;

  beforeEach(async () => {
    availabilityServiceSpy = jasmine.createSpyObj('MenuAvailabilityService', [
      'getPeriods', 'getSchedule', 'addPeriod', 'updatePeriod', 'deletePeriod', 'updateSchedule',
    ]);
    availabilityServiceSpy.getPeriods.and.returnValue(of(mockPeriods));
    availabilityServiceSpy.getSchedule.and.returnValue(of(mockSchedule));

    await TestBed.configureTestingModule({
      imports: [ScheduleManagement],
      providers: [
        { provide: MenuAvailabilityService, useValue: availabilityServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load periods on init', () => {
    expect(availabilityServiceSpy.getPeriods).toHaveBeenCalled();
    expect(component.periods.length).toBe(2);
  });

  it('should load schedule on init', () => {
    expect(availabilityServiceSpy.getSchedule).toHaveBeenCalled();
    expect(component.closedDays).toContain(2);
  });

  it('should open add form', () => {
    component.addNewPeriod();
    expect(component.showForm).toBeTrue();
    expect(component.editingPeriod).toBeNull();
  });

  it('should edit period', () => {
    component.editPeriod(mockPeriods[0]);
    expect(component.showForm).toBeTrue();
    expect(component.editingPeriod?.id).toBe('p1');
    expect(component.newPeriod.name).toBe('Menú Mediodía');
  });

  it('should toggle a day in form', () => {
    component.addNewPeriod();
    expect(component.isDaySelected(2)).toBeFalse();
    component.toggleDayInForm(2);
    expect(component.isDaySelected(2)).toBeTrue();
    component.toggleDayInForm(2);
    expect(component.isDaySelected(2)).toBeFalse();
  });

  it('should not save period without name', async () => {
    component.addNewPeriod();
    component.newPeriod.days = [1];
    await component.savePeriod();
    expect(availabilityServiceSpy.addPeriod).not.toHaveBeenCalled();
  });

  it('should create new period', async () => {
    availabilityServiceSpy.addPeriod.and.returnValue(Promise.resolve('p3'));
    component.addNewPeriod();
    component.newPeriod.name = 'Desayuno';
    component.newPeriod.days = [1, 2, 3];
    await component.savePeriod();
    expect(availabilityServiceSpy.addPeriod).toHaveBeenCalled();
  });

  it('should update existing period', async () => {
    availabilityServiceSpy.updatePeriod.and.returnValue(Promise.resolve());
    component.editPeriod(mockPeriods[0]);
    component.newPeriod.name = 'Menú Actualizado';
    await component.savePeriod();
    expect(availabilityServiceSpy.updatePeriod).toHaveBeenCalledWith('p1', jasmine.objectContaining({ name: 'Menú Actualizado' }));
  });

  it('should delete period', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    availabilityServiceSpy.deletePeriod.and.returnValue(Promise.resolve());
    component.deletePeriod(mockPeriods[0]);
    expect(availabilityServiceSpy.deletePeriod).toHaveBeenCalledWith('p1');
  });

  it('should toggle closed day', () => {
    component.toggleClosedDay(2);
    expect(component.closedDays).not.toContain(2);
    component.toggleClosedDay(2);
    expect(component.closedDays).toContain(2);
  });

  it('should add and remove closed date', () => {
    component.newClosedDate = '2026-12-25';
    component.addClosedDate();
    expect(component.closedDates).toContain('2026-12-25');
    component.removeClosedDate('2026-12-25');
    expect(component.closedDates).not.toContain('2026-12-25');
  });

  it('should save schedule', async () => {
    availabilityServiceSpy.updateSchedule.and.returnValue(Promise.resolve());
    component.closedDays = [2, 0];
    await component.saveSchedule();
    expect(availabilityServiceSpy.updateSchedule).toHaveBeenCalledWith(
      jasmine.objectContaining({ closedDays: [2, 0] })
    );
  });
});
