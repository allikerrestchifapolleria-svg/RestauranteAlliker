export type SunatDocType = '01' | '03';

export const SUNAT_DOC_TYPES: Record<SunatDocType, string> = {
  '01': 'Factura',
  '03': 'Boleta'
};

export type DocTypeCode = '1' | '6' | '4';

export const DOC_TYPE_CODES: Record<DocTypeCode, string> = {
  '1': 'DNI',
  '6': 'RUC',
  '4': 'Carnet de Extranjería'
};

export interface CompanyAddress {
  street: string;
  district: string;
  province: string;
  department: string;
  country: string;
}

export interface CompanyData {
  ruc: string;
  businessName: string;
  commercialName: string;
  ownerName?: string;
  address: CompanyAddress;
  phone: string;
  email: string;
  accountNumber: string;
  logoUrl?: string;
  resolutionNumber?: string;
  production: boolean;
}

export interface CustomerData {
  docType: DocTypeCode;
  docNumber: string;
  name: string;
  address?: string;
  email?: string;
}

export interface InvoiceLineItem {
  lineNumber: number;
  productCode: string;
  description: string;
  quantity: number;
  unitCode: string;
  unitPriceWithoutIgv: number;
  totalPriceWithoutIgv: number;
  igvAmount: number;
  totalPriceWithIgv: number;
}

export interface InvoiceData {
  id: string;
  serieNumber: string;
  orderId: string;
  orderNumber?: number;
  saleId: string;
  issueDate: string;
  issueTime: string;
  documentType: SunatDocType;
  currency: string;
  company: CompanyData;
  customer: CustomerData;
  items: InvoiceLineItem[];
  subtotal: number;
  igv: number;
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  xmlContent?: string;
  xmlHash?: string;
  sunatStatus?: 'pending' | 'sent' | 'accepted' | 'rejected';
  cdrCode?: string;
  cdrNotes?: string;
  createdAt: Date;
}

export interface CorrelativeCounter {
  id: string;
  documentType: SunatDocType;
  serie: string;
  currentNumber: number;
}
