import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../../services/company.service';
import { CompanyData } from '../../../models/invoice';

@Component({
  selector: 'app-company-config',
  imports: [CommonModule, FormsModule],
  templateUrl: './company-config.html',
  styleUrl: './company-config.css'
})
export class CompanyConfig implements OnInit {
  company: CompanyData | null = null;
  loading = true;
  saving = false;
  saved = false;
  error = '';
  fieldErrors: Record<string, string> = {};

  constructor(
    private companyService: CompanyService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    console.log('[COMPANY-CONFIG] ngOnInit - iniciando carga de configuracion');
    try {
      const company = await this.companyService.getCompanyOnce();
      console.log('[COMPANY-CONFIG] Configuracion cargada:', company);
      this.ngZone.run(() => {
        this.company = company;
        this.loading = false;
        this.cdr.detectChanges();
        console.log('[COMPANY-CONFIG] loading = false (vista actualizada)');
      });
    } catch (e) {
      console.error('[COMPANY-CONFIG] ERROR al cargar configuracion:', e);
      this.ngZone.run(() => {
        this.error = 'Error al cargar configuración';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async save() {
    if (!this.company) return;

    this.saved = false;
    this.error = '';
    this.fieldErrors = {};

    if (!this.company.ruc || !this.company.ruc.trim()) {
      this.fieldErrors['ruc'] = 'El RUC es obligatorio';
    }
    if (!this.company.businessName || !this.company.businessName.trim()) {
      this.fieldErrors['businessName'] = 'La Razón Social es obligatoria';
    }

    if (Object.keys(this.fieldErrors).length > 0) {
      this.error = Object.values(this.fieldErrors)[0];
      return;
    }

    this.saving = true;
    try {
      await this.companyService.saveCompany(this.company);
      console.log('[COMPANY-CONFIG] Configuracion guardada en Firestore');
      this.ngZone.run(() => {
        this.saving = false;
        this.saved = true;
        this.cdr.detectChanges();
      });
      setTimeout(() => {
        this.ngZone.run(() => {
          this.saved = false;
          this.cdr.detectChanges();
        });
      }, 3000);
    } catch (err) {
      console.error('[COMPANY-CONFIG] Error guardando configuracion:', err);
      this.ngZone.run(() => {
        this.error = 'Error al guardar. Intente de nuevo.';
        this.saving = false;
        this.cdr.detectChanges();
      });
    }
  }

  trackByFn(index: number) {
    return index;
  }
}
