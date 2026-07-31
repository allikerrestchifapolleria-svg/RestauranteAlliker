/**
 * Franja de servicio: define en qué días y a qué horas se vende un grupo de platos.
 * Ej: "Menú Mediodía" 11:00-16:00, "Pollería Noche" 17:00-01:00 (cruza medianoche).
 */
export interface ServicePeriod {
  id: string;
  name: string;
  /** 0=domingo ... 6=sábado. Días en los que la franja abre. */
  days: number[];
  /** "HH:mm" en hora de Lima. */
  startTime: string;
  /** "HH:mm". Si es menor que startTime, la franja termina al día siguiente. */
  endTime: string;
  icon: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuración global del local. Los días de descanso cierran todas las franjas,
 * sin importar cómo estén configuradas cada una.
 */
export interface RestaurantSchedule {
  /** 0=domingo ... 6=sábado. Ej: [2] = martes cerrado. */
  closedDays: number[];
  /** Cierres puntuales en formato "YYYY-MM-DD" (feriados, mantenimiento). */
  closedDates: string[];
  /** Mensaje que ve el cliente cuando el local está cerrado. */
  closedMessage: string;
  updatedAt?: Date;
}

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
];

export const DEFAULT_RESTAURANT_SCHEDULE: RestaurantSchedule = {
  closedDays: [2],
  closedDates: [],
  closedMessage: 'Hoy es nuestro día de descanso. ¡Te esperamos mañana!',
};
