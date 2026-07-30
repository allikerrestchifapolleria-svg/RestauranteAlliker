import { Injectable, NgZone } from '@angular/core';
import { collection, doc, getDoc, setDoc, addDoc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../firebase.config';
import { InvoiceData, SunatDocType } from '../models/invoice';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  constructor(private ngZone: NgZone) {}

  getInvoices(): Observable<InvoiceData[]> {
    console.log('[INVOICE-SERVICE] getInvoices() -> creando listener onSnapshot en "invoices"');
    const ref = collection(db, 'invoices');
    const q = query(ref, orderBy('createdAt', 'desc'));
    return new Observable<InvoiceData[]>(subscriber => {
      const unsubscribe = onSnapshot(
        q,
        snapshot => {
          this.ngZone.run(() => {
            const invoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceData));
            console.log('[INVOICE-SERVICE] onSnapshot -> ' + invoices.length + ' comprobantes recibidos');
            subscriber.next(invoices);
          });
        },
        error => {
          console.error('[INVOICE-SERVICE] onSnapshot ERROR (revisar Firestore rules / indice de "createdAt"):', error);
          this.ngZone.run(() => subscriber.error(error));
        }
      );
      return unsubscribe;
    });
  }

  async getInvoiceById(id: string): Promise<InvoiceData | null> {
    const ref = doc(db, 'invoices', id);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as InvoiceData) : null;
  }

  async saveInvoice(invoice: InvoiceData): Promise<string> {
    const ref = collection(db, 'invoices');
    const docRef = await addDoc(ref, {
      ...invoice,
      createdAt: new Date()
    });
    return docRef.id;
  }

  async updateSunatStatus(id: string, status: InvoiceData['sunatStatus'], cdrCode?: string, cdrNotes?: string): Promise<void> {
    const ref = doc(db, 'invoices', id);
    await updateDoc(ref, { sunatStatus: status, cdrCode: cdrCode || null, cdrNotes: cdrNotes || null } as any);
  }

  async getNextCorrelative(docType: SunatDocType): Promise<string> {
    const serie = docType === '01' ? 'F001' : 'B001';
    const counterId = `counter_${serie}`;
    const ref = doc(db, 'counters', counterId);

    const snap = await getDoc(ref);
    let currentNumber = 1;

    if (snap.exists()) {
      const data = snap.data();
      currentNumber = (data['currentNumber'] || 0) + 1;
    }

    await setDoc(ref, {
      documentType: docType,
      serie,
      currentNumber,
      updatedAt: new Date()
    });

    const padded = String(currentNumber).padStart(8, '0');
    return `${serie}-${padded}`;
  }

  async getCurrentCorrelative(docType: SunatDocType): Promise<string> {
    const serie = docType === '01' ? 'F001' : 'B001';
    const counterId = `counter_${serie}`;
    const ref = doc(db, 'counters', counterId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return `${serie}-${String(1).padStart(8, '0')}`;
    }

    const data = snap.data();
    const currentNumber = data['currentNumber'] || 0;
    const padded = String(currentNumber).padStart(8, '0');
    return `${serie}-${padded}`;
  }
}
