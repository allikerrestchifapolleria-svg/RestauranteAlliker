export interface AppUser {
  id: string;
  branchId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  // Ya no se persiste en Firestore: las contraseñas viven solo en Firebase Auth,
  // gestionadas via netlify/functions/admin-*-user.ts. Se usa localmente para
  // el formulario de creacion/reseteo de contraseña, nunca para mostrarla.
  password?: string;
  role: string;
  createdAt: Date;
}