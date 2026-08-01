import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnInit {
  form: FormGroup;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  private returnUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: Auth,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ ...confirmPassword.errors, mismatch: true });
    } else if (confirmPassword?.hasError('mismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['mismatch'];
      confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
    }
    return null;
  }

  getPasswordStrength(): number {
    const password = this.form.get('password')?.value || '';
    let strength = 0;
    if (password.length >= 6) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
  }

  getProgressClass(): string {
    const strength = this.getPasswordStrength();
    if (strength < 2) return 'bg-danger';
    if (strength < 4) return 'bg-warning';
    return 'bg-success';
  }

  togglePasswordVisibility(field: string) {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
      const input = document.getElementById('password') as HTMLInputElement;
      if (input) input.type = this.showPassword ? 'text' : 'password';
    } else if (field === 'confirmPassword') {
      this.showConfirmPassword = !this.showConfirmPassword;
      const input = document.getElementById('confirmPassword') as HTMLInputElement;
      if (input) input.type = this.showConfirmPassword ? 'text' : 'password';
    }
  }

  onSubmit() {
    console.log('Form submitted');
    console.log('Form valid:', this.form.valid);
    console.log('Form value:', this.form.value);
    if (this.form.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const { nombre, apellidos, email, password } = this.form.value;
      const fullName = `${nombre} ${apellidos}`.trim();

      this.authService.register(fullName, email, password).then((result) => {
        this.isLoading = false;
        if (result.success) {
          this.successMessage = 'Registro exitoso. Bienvenido!';
          setTimeout(() => {
            this.router.navigate([this.returnUrl || '/']);
          }, 2000);
        } else {
          this.errorMessage = result.message || 'Error al registrar la cuenta.';
        }
      }).catch((error) => {
        console.error('Error creating user:', error);
        this.isLoading = false;
        this.errorMessage = 'Error de conexión';
      });
    } else {
      console.log('Form invalid');
      this.form.markAllAsTouched();
      this.errorMessage = 'Por favor complete todos los campos correctamente';
    }
  }

  /**
   * Alta con Google. El boton existia en la plantilla desde el principio pero sin
   * (click): no llamaba a nada, por eso al pulsarlo no pasaba nada ni aparecia
   * ninguna traza en consola.
   *
   * Reutiliza loginWithGoogle porque handleSocialLogin ya crea el perfil en
   * Firestore la primera vez (devuelve isNewUser) y lo reutiliza las siguientes.
   */
  registerWithGoogle() {
    console.log('[REGISTER] registerWithGoogle: pulsado');
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.loginWithGoogle().then((result) => {
      console.log('[REGISTER] registerWithGoogle resultado:', result);
      this.isLoading = false;

      if (result.success) {
        this.successMessage = result.isNewUser
          ? 'Cuenta creada con Google. Redirigiendo...'
          : 'Ya tenias cuenta con este correo. Entrando...';
        setTimeout(() => this.router.navigate([this.returnUrl || '/']), 1500);
      } else {
        this.errorMessage = result.message || 'Error al registrarse con Google.';
      }
    }).catch((error) => {
      console.error('[REGISTER] registerWithGoogle EXCEPCION:', error);
      this.isLoading = false;
      this.errorMessage = 'Error de conexión. Inténtalo de nuevo.';
    });
  }

  goToLogin() {
    // Arrastra el returnUrl para no perder el destino al alternar entre
    // registro e inicio de sesion.
    this.router.navigate(['/login'], {
      queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : {}
    });
  }
}