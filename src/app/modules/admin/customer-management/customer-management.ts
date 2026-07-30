import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomerService } from '../../../services/customer';
import { Customer } from '../../../models/customer';

@Component({
  selector: 'app-customer-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-management.html',
  styleUrl: './customer-management.css',
})
export class CustomerManagement implements OnInit {
  customers$: Observable<Customer[]> = new Observable<Customer[]>();
  searchTerm: string = '';
  searchTerm$ = new BehaviorSubject<string>('');
  filteredCustomers$: Observable<Customer[]>;
  showAddForm: boolean = false;
  editingCustomer: Customer | null = null;
  nameError: string = '';
  phoneError: string = '';

  // Form data
  newCustomer: Partial<Customer> = {
    name: '',
    email: '',
    phone: '',
    totalOrders: 0,
    favoriteItems: []
  };

  // Helper properties for form
  favoriteItemsString: string = '';

  constructor(private customerService: CustomerService) {
    this.customers$ = this.customerService.getCustomers();
    this.filteredCustomers$ = combineLatest([this.customers$, this.searchTerm$]).pipe(
      map(([customers, term]) =>
        customers.filter(customer => {
          const name = customer.name?.toLowerCase() || '';
          const email = customer.email?.toLowerCase() || '';
          const phone = customer.phone?.toLowerCase() || '';
          return name.includes(term.toLowerCase()) ||
                 email.includes(term.toLowerCase()) ||
                 phone.includes(term.toLowerCase());
        })
      )
    );
  }

  ngOnInit() {
    // No need to subscribe manually, using async pipe in template
  }


  onSearch() {
    // Emit the current search term to trigger filtering
    this.searchTerm$.next(this.searchTerm);
  }

  addNewCustomer() {
    this.showAddForm = true;
    this.editingCustomer = null;
    this.resetForm();
  }

  editCustomer(customer: Customer) {
    this.showAddForm = true;
    this.editingCustomer = customer;
    this.newCustomer = { ...customer };
    // Convert arrays to strings for form
    this.favoriteItemsString = customer.favoriteItems ? customer.favoriteItems.join(', ') : '';
  }

  async saveCustomer() {
    try {
      this.nameError = '';
      this.phoneError = '';

      if (!this.newCustomer.name || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.newCustomer.name)) {
        this.nameError = 'Solo se permiten letras y espacios';
        return;
      }
      if (this.newCustomer.phone && !/^[0-9]{1,9}$/.test(this.newCustomer.phone)) {
        this.phoneError = 'Solo se permiten números (máximo 9 dígitos)';
        return;
      }

      const favoriteItems = this.favoriteItemsString ? this.favoriteItemsString.split(',').map(item => item.trim()).filter(item => item) : [];

      const customerData = {
        ...this.newCustomer,
        favoriteItems: favoriteItems
      };

      if (this.editingCustomer) {
        // Update existing customer
        console.log('Updating customer:', customerData);
        await this.customerService.updateCustomer(this.editingCustomer.id, customerData);
        this.cancelEdit();
      } else {
        // Add new customer
        const result = await this.customerService.registerCustomer(this.newCustomer.name!, this.newCustomer.email!, this.newCustomer.phone);
        if (result.success) {
          console.log('Customer added');
          this.cancelEdit();
        } else {
          alert(result.message);
        }
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error al guardar el cliente. Por favor, inténtalo de nuevo.');
    }
  }

  deleteCustomer(customer: Customer) {
    if (confirm(`¿Estás seguro de que quieres eliminar al cliente "${customer.name}"?`)) {
      this.customerService.deleteCustomer(customer.id).then(() => {
        console.log('Customer deleted');
      });
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingCustomer = null;
    this.resetForm();
  }

  private resetForm() {
    this.newCustomer = {
      name: '',
      email: '',
      phone: '',
      totalOrders: 0,
      favoriteItems: []
    };
    this.favoriteItemsString = '';
  }

  onNameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newCustomer.name = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    this.nameError = '';
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newCustomer.phone = input.value.replace(/\D/g, '').slice(0, 9);
    this.phoneError = '';
  }

  adjustNumericField(target: any, key: string, delta: number, min: number = 0) {
    const current = Number(target[key]) || 0;
    target[key] = Math.max(min, current + delta);
  }
}