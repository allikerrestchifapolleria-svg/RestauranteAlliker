/**
 * Recipiente que se cobra al cliente en pedidos para llevar
 * (táper plástico, caja de cartón, bolsa, etc.).
 */
export interface TakeoutContainer {
  id: string;
  name: string;
  /** Precio unitario en soles que se recarga a la cuenta. */
  price: number;
  description: string;
  /** Se preselecciona al agregar un item en un pedido para llevar. */
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
