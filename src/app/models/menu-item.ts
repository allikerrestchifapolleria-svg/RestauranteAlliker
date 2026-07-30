export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  tags: string[];
  variants: MenuVariant[];
  modifiers: MenuModifier[];
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MenuVariant = { name: string; price: number };

export type MenuModifier = { name: string; price?: number };