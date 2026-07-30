import { Injectable } from '@angular/core';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { CompanyData } from '../models/invoice';

const COMPANY_DOC_ID = 'alliker-main';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  async getCompanyOnce(): Promise<CompanyData> {
    console.log('[COMPANY-SERVICE] getCompanyOnce() -> leyendo config/' + COMPANY_DOC_ID);
    const ref = doc(db, 'config', COMPANY_DOC_ID);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      console.log('[COMPANY-SERVICE] Documento encontrado:', snap.data());
      return snap.data() as CompanyData;
    }
    console.warn('[COMPANY-SERVICE] Documento config/' + COMPANY_DOC_ID + ' no existe, usando valores por defecto');
    return this.getDefaultCompany();
  }

  async saveCompany(data: CompanyData): Promise<void> {
    const ref = doc(db, 'config', COMPANY_DOC_ID);
    await setDoc(ref, { ...data, updatedAt: new Date() }, { merge: true });
  }

  async updateCompany(updates: Partial<CompanyData>): Promise<void> {
    const ref = doc(db, 'config', COMPANY_DOC_ID);
    await updateDoc(ref, { ...updates, updatedAt: new Date() } as any);
  }

  getDefaultCompany(): CompanyData {
    return {
      ruc: '10425772045',
      businessName: 'RESTAURANTE - CHIFA - POLLERÍA',
      commercialName: 'ALLIKER',
      ownerName: 'RONCAL GAMBOA EBER HERMAN',
      address: {
        street: 'Av. Juan Velasco S/N - C.P. Chao',
        district: 'Chao',
        province: 'Virú',
        department: 'La Libertad',
        country: 'PE'
      },
      phone: '922729872 / 912412167',
      email: 'info@alliker.pe',
      accountNumber: '',
      production: false
    };
  }
}
