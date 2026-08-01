import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Auth, UserRole } from '../../../services/auth';
import { BranchSelectionService } from '../../../services/branch-selection';
import { BranchService } from '../../../services/branch';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  loginForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    rememberMe: new FormControl(false)
  });
  showPassword: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  private returnUrl: string | null = null;

  constructor(
    private auth: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private branchSelection: BranchSelectionService,
    private branchService: BranchService
  ) {}

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Por favor complete todos los campos correctamente';
      return;
    }

    const { email, password } = this.loginForm.value;
     console.log('Login.onSubmit called with email:', email);

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auth.login(email, password).then(result => {
      console.log('Login result:', result);
      this.isLoading = false;

      if (result.success && result.role) {
        this.branchService.getBranches().subscribe(branches => {
          this.branchSelection.setBranches(branches);
          this.branchSelection.initializeFromUserBranch(this.auth.getUserBranchId());
        });

        this.successMessage = '¡Inicio de sesión exitoso! Redirigiendo...';
        this.redirectBasedOnRole(result.role as UserRole);
      } else {
        this.errorMessage = result.message || 'Credenciales inválidas. Verifica tu email y contraseña.';
      }
    }).catch((error) => {
      console.log('Login error:', error);
      this.isLoading = false;
      this.errorMessage = 'Error de conexión. Inténtalo de nuevo.';
    });
  }

  private redirectBasedOnRole(role: UserRole) {
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin']);
        break;
      case 'cook':
        if (!this.auth.getUserBranchId() && !this.branchSelection.getSelectedBranchId()) {
          this.router.navigate(['/no-branch']);
        } else {
          this.router.navigate(['/kitchen']);
        }
        break;
      case 'waiter':
        if (!this.auth.getUserBranchId() && !this.branchSelection.getSelectedBranchId()) {
          this.router.navigate(['/no-branch']);
        } else {
          this.router.navigate(['/waiter']);
        }
        break;
      case 'user':
      default:
        this.router.navigate([this.returnUrl || '/']);
        break;
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.type = this.showPassword ? 'text' : 'password';
    }
  }

  forgotPassword() {
    const email = this.loginForm.get('email')?.value;
    if (!email) {
      this.errorMessage = 'Ingresa tu email en el campo de arriba y vuelve a hacer clic en "Olvidé mi contraseña".';
      return;
    }

    this.auth.resetPassword(email).then(result => {
      if (result.success) {
        this.successMessage = `Se envio un correo a ${email} con instrucciones para restablecer tu contraseña.`;
        this.errorMessage = '';
      } else {
        this.errorMessage = result.message || 'No se pudo enviar el correo de recuperacion.';
      }
    });
  }

  loginWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auth.loginWithGoogle().then(result => {
      console.log('[LOGIN] loginWithGoogle result:', result);
      this.isLoading = false;

      if (result.success && result.role) {
        this.branchService.getBranches().subscribe(branches => {
          this.branchSelection.setBranches(branches);
          this.branchSelection.initializeFromUserBranch(this.auth.getUserBranchId());
        });

        this.successMessage = result.isNewUser
          ? 'Cuenta creada con Google. Redirigiendo...'
          : 'Inicio de sesion con Google exitoso. Redirigiendo...';
        this.redirectBasedOnRole(result.role as UserRole);
      } else {
        console.error('[LOGIN] loginWithGoogle fallo:', result.message);
        this.errorMessage = result.message || 'Error al iniciar sesion con Google.';
      }
    }).catch((error) => {
      console.error('[LOGIN] loginWithGoogle excepcion inesperada:', error);
      this.isLoading = false;
      this.errorMessage = 'Error de conexion. Intentalo de nuevo.';
    });
  }

  // Botón oculto en el template por ahora (ver login.html); se deja el método
  // listo para reactivar el login con Facebook en una versión futura.
  loginWithFacebook() {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auth.loginWithFacebook().then(result => {
      this.isLoading = false;

      if (result.success && result.role) {
        this.branchService.getBranches().subscribe(branches => {
          this.branchSelection.setBranches(branches);
          this.branchSelection.initializeFromUserBranch(this.auth.getUserBranchId());
        });

        this.successMessage = result.isNewUser
          ? 'Cuenta creada con Facebook. Redirigiendo...'
          : 'Inicio de sesion con Facebook exitoso. Redirigiendo...';
        this.redirectBasedOnRole(result.role as UserRole);
      } else {
        this.errorMessage = result.message || 'Error al iniciar sesion con Facebook.';
      }
    }).catch(() => {
      this.isLoading = false;
      this.errorMessage = 'Error de conexion. Intentalo de nuevo.';
    });
  }

  goToRegister() {
    // Arrastra el returnUrl: quien llego aqui desde /reservations debe volver
    // alli tras registrarse, no a la portada.
    this.router.navigate(['/register'], {
      queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : {}
    });
  }
}