import { Injectable } from '@angular/core';
import { InvoiceData, InvoiceLineItem, SunatDocType, CustomerData } from '../models/invoice';

@Injectable({ providedIn: 'root' })
export class InvoiceBuilderService {

  buildInvoiceData(
    params: {
      orderId: string;
      orderNumber?: number;
      saleId: string;
      serieNumber: string;
      documentType: SunatDocType;
      company: any;
      customer: CustomerData;
      items: { name: string; quantity: number; price: number; total: number }[];
      subtotal: number;
      igv: number;
      total: number;
      paymentMethod: string;
      paymentAmount: number;
    }
  ): InvoiceData {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 8);

    const lineItems: InvoiceLineItem[] = params.items.map((item, index) => {
      const priceWithoutIgv = item.price / 1.18;
      const totalWithoutIgv = item.total / 1.18;
      const igvAmount = item.total - totalWithoutIgv;
      return {
        lineNumber: index + 1,
        productCode: item.name.substring(0, 30),
        description: item.name,
        quantity: item.quantity,
        unitCode: 'NIU',
        unitPriceWithoutIgv: Math.round(priceWithoutIgv * 100) / 100,
        totalPriceWithoutIgv: Math.round(totalWithoutIgv * 100) / 100,
        igvAmount: Math.round(igvAmount * 100) / 100,
        totalPriceWithIgv: item.total
      };
    });

    const invoiceData: InvoiceData = {
      id: '',
      serieNumber: params.serieNumber,
      orderId: params.orderId,
      saleId: params.saleId,
      issueDate: dateStr,
      issueTime: timeStr,
      documentType: params.documentType,
      currency: 'PEN',
      company: params.company,
      customer: params.customer,
      items: lineItems,
      subtotal: params.subtotal,
      igv: params.igv,
      total: params.total,
      paymentMethod: params.paymentMethod,
      paymentAmount: params.paymentAmount,
      createdAt: now
    };

    if (params.orderNumber !== undefined) {
      invoiceData.orderNumber = params.orderNumber;
    }

    return invoiceData;
  }

  generateUblXml(invoice: InvoiceData): string {
    const dt = invoice.documentType;
    const typeCode = dt;
    const typeName = dt === '01' ? 'FACTURA' : 'BOLETA';
    const serieNum = invoice.serieNumber;
    const c = invoice.company;
    const cust = invoice.customer;

    const linesXml = invoice.items.map(item => `
          <cac:InvoiceLine>
            <cbc:ID>${item.lineNumber}</cbc:ID>
            <cbc:InvoicedQuantity unitCode="${item.unitCode}">${item.quantity}</cbc:InvoicedQuantity>
            <cbc:LineExtensionAmount currencyID="PEN">${item.totalPriceWithoutIgv.toFixed(2)}</cbc:LineExtensionAmount>
            <cac:PricingReference>
              <cac:AlternativeConditionPrice>
                <cbc:PriceAmount currencyID="PEN">${(item.unitPriceWithoutIgv * 1.18).toFixed(2)}</cbc:PriceAmount>
                <cac:PriceTypeCode>01</cac:PriceTypeCode>
              </cac:AlternativeConditionPrice>
            </cac:PricingReference>
            <cac:TaxTotal>
              <cbc:TaxAmount currencyID="PEN">${item.igvAmount.toFixed(2)}</cbc:TaxAmount>
              <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="PEN">${item.totalPriceWithoutIgv.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="PEN">${item.igvAmount.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory>
                  <cbc:Percent>18.00</cbc:Percent>
                  <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
                  <cac:TaxScheme>
                    <cbc:ID>1000</cbc:ID>
                    <cbc:Name>IGV</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                  </cac:TaxScheme>
                </cac:TaxCategory>
              </cac:TaxSubtotal>
            </cac:TaxTotal>
            <cac:Item>
              <cbc:Description>${this.escapeXml(item.description)}</cbc:Description>
              <cac:SellersItemIdentification>
                <cbc:ID>${this.escapeXml(item.productCode)}</cbc:ID>
              </cac:SellersItemIdentification>
            </cac:Item>
            <cac:Price>
              <cbc:PriceAmount currencyID="PEN">${item.unitPriceWithoutIgv.toFixed(2)}</cbc:PriceAmount>
            </cac:Price>
          </cac:InvoiceLine>`).join('\n');

    const itemsXml = invoice.items.map(item => {
      const priceWithIgv = item.unitPriceWithoutIgv * 1.18;
      return { ...item, unitPriceWithIgv: Math.round(priceWithIgv * 100) / 100 };
    });

    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${this.escapeXml(serieNum)}</cbc:ID>
  <cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${invoice.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="0101">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${invoice.currency}</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>IDSignF</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${this.escapeXml(c.ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[${c.businessName}]]></cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#signature</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${this.escapeXml(c.ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${c.businessName}]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:StreetName>${this.escapeXml(c.address.street)}</cbc:StreetName>
          <cbc:CitySubdivisionName>-</cbc:CitySubdivisionName>
          <cbc:CityName>${this.escapeXml(c.address.province)}</cbc:CityName>
          <cbc:CountrySubentity>${this.escapeXml(c.address.department)}</cbc:CountrySubentity>
          <cbc:District>${this.escapeXml(c.address.district)}</cbc:District>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${cust.docType}">${this.escapeXml(cust.docNumber)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${cust.name}]]></cbc:RegistrationName>
        ${cust.address ? `<cac:RegistrationAddress>
          <cbc:StreetName>${this.escapeXml(cust.address)}</cbc:StreetName>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${invoice.igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${invoice.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${invoice.igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${invoice.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${invoice.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${invoice.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;

    return xml;
  }

  async computeXmlHash(xmlContent: string): Promise<string> {
    const data = new TextEncoder().encode(xmlContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashBytes = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashBytes));
  }

  private escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
