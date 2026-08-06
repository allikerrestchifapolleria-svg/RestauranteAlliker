export interface MenuCategory {
  id: string;
  name: string;
  active: boolean;
  /** Franjas que heredan los platos de la categoría sin franjas propias. Vacío = todo el día. */
  defaultServicePeriodIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}