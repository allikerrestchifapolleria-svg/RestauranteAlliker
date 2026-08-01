import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppUser } from '../../../models/user';
import { UserService } from '../../../services/user';
import { BranchService } from '../../../services/branch';
import { Branch } from '../../../models/branch';

@Component({
  selector: 'app-user-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
})
export class UserManagement implements OnInit {
  users$: Observable<AppUser[]> = new Observable<AppUser[]>();
  branches$: Observable<Branch[]> = new Observable<Branch[]>();
  usersWithBranch$: Observable<any[]> = new Observable<any[]>();
  isLoading: boolean = false;
  showCreateForm: boolean = false;
  showEditModal: boolean = false;
  editingUser: AppUser | null = null;
  successMessage: string = '';
  errorMessage: string = '';
  generatedPassword: string = '';
  showPassword: boolean = false;

  // Form fields
  nombre: string = '';
  apellidos: string = '';
  newUser: any = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'waiter',
    branchId: null
  };

  editingNombre: string = '';
  editingApellidos: string = '';

  branches: Branch[] = [];

  constructor(private userService: UserService, private branchService: BranchService) {}

  ngOnInit() {
    this.branches$ = this.branchService.getBranches();
    this.users$ = this.userService.getUsers();

    this.usersWithBranch$ = combineLatest([this.users$, this.branches$]).pipe(
      map(([users, branches]) => {
        this.branches = branches;
        return users.map(user => ({
          ...user,
          branchLabel: this.getBranchName(user.branchId)
        }));
      })
    );
  }

  getBranchName(branchId: string | null): string {
    if (!branchId) return 'N/A';
    const branch = this.branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  }

  createUser() {
    console.log('createUser called');
    console.log('Form data:', {
      nombre: this.nombre,
      apellidos: this.apellidos,
      newUser: this.newUser
    });

    this.successMessage = '';
    this.errorMessage = '';

    if (!this.nombre || !this.apellidos || !this.newUser.email || !this.newUser.role || !this.newUser.branchId) {
      console.log('Validation failed - missing required fields');
      this.errorMessage = 'Por favor complete todos los campos requeridos';
      return;
    }

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.nombre) || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.apellidos)) {
      this.errorMessage = 'Nombre y apellidos solo permiten letras y espacios';
      return;
    }

    // Generate random password
    const generatedPassword = this.newUser.password || this.generatePassword();
    this.newUser.password = generatedPassword;
    this.newUser.firstName = this.nombre;
    this.newUser.lastName = this.apellidos;
    console.log('User data to send:', this.newUser);

    this.userService.createUser(this.newUser as Omit<AppUser, 'id' | 'createdAt'>).then(() => {
      console.log('User created successfully');
      this.successMessage = 'Usuario creado exitosamente';
      this.generatedPassword = this.newUser.password;
      this.nombre = '';
      this.apellidos = '';
      this.newUser = { firstName: '', lastName: '', email: '', password: '', role: 'waiter', branchId: null };
      this.showCreateForm = false;
    }).catch((error) => {
      console.error('Error creating user:', error);
      this.errorMessage = 'Error al crear el usuario';
    });
  }

  generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    const randomValues = new Uint32Array(8);
    // crypto.getRandomValues es CSPRNG; no usar Math.random para credenciales.
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(randomValues[i] % chars.length);
    }
    return password;
  }

  generateAndShowPassword() {
    this.newUser.password = this.generatePassword();
  }

  editUser(user: AppUser) {
    this.editingUser = { ...user };
    this.editingNombre = user.firstName || '';
    this.editingApellidos = user.lastName || '';
    this.showEditModal = true;
  }

  updateUser() {
    if (!this.editingUser) return;

    if (this.editingNombre && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.editingNombre)) {
      this.errorMessage = 'El nombre solo permite letras y espacios';
      return;
    }
    if (this.editingApellidos && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(this.editingApellidos)) {
      this.errorMessage = 'Los apellidos solo permiten letras y espacios';
      return;
    }

    this.editingUser!.firstName = this.editingNombre;
    this.editingUser!.lastName = this.editingApellidos;

    this.userService.updateUser(this.editingUser.id, this.editingUser).then(() => {
      this.editingUser = null;
      this.editingNombre = '';
      this.editingApellidos = '';
      this.errorMessage = '';
      this.showEditModal = false;
    }).catch((error) => {
      console.error('Error updating user:', error);
      this.errorMessage = error?.message || 'Error al actualizar el usuario';
    });
  }

  deleteUser(user: AppUser) {
    if (confirm(`¿Está seguro de eliminar al usuario ${this.getFullName(user)}?`)) {
      this.userService.deleteUser(user.id).catch((error) => {
        console.error('Error deleting user:', error);
        this.errorMessage = error?.message || 'Error al eliminar el usuario';
      });
    }
  }

  cancelEdit() {
    this.editingUser = null;
    this.editingNombre = '';
    this.editingApellidos = '';
    this.showEditModal = false;
  }

  getFullName(user: AppUser): string {
    const first = user.firstName?.trim() || '';
    const last = user.lastName?.trim() || '';
    return `${first} ${last}`.trim();
  }

  getRoleLabel(role: string): string {
    const labels = {
      admin: 'Admin',
      cook: 'Cocinero',
      waiter: 'Mozo',
      user: 'Cliente'
    };
    return labels[role as keyof typeof labels] || role;
  }

  onNombreInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.nombre = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
  }

  onApellidosInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.apellidos = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
  }

  onEditingNombreInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingNombre = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
  }

  onEditingApellidosInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingApellidos = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
  }

}