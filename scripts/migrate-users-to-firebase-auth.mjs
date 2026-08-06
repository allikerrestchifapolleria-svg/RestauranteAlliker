// Script de migracion UNICA: mueve los usuarios legacy (guardados en Firestore
// con password en texto plano y un ID de documento aleatorio) a cuentas reales
// de Firebase Authentication, con el documento de Firestore viviendo en
// users/{uid}. Necesario para que firestore.rules (que depende de
// request.auth.uid) funcione con los usuarios existentes.
//
// Uso:
//   1. Genera una clave de cuenta de servicio en Firebase Console:
//      Configuracion del proyecto > Cuentas de servicio > Generar nueva clave privada.
//   2. Guarda ese JSON en un archivo local (NO lo subas al repositorio) y exporta:
//        PowerShell:  $env:FIREBASE_SERVICE_ACCOUNT_KEY = Get-Content .\service-account.json -Raw
//        bash:        export FIREBASE_SERVICE_ACCOUNT_KEY="$(cat service-account.json)"
//   3. Primero corre en modo simulacion (no escribe nada):
//        node scripts/migrate-users-to-firebase-auth.mjs
//   4. Revisa el resumen impreso y, si todo se ve bien, aplica de verdad:
//        node scripts/migrate-users-to-firebase-auth.mjs --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error('Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY con el JSON de la cuenta de servicio.');
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY no contiene un JSON valido.');
    process.exit(1);
  }
}

const app = initializeApp({ credential: cert(loadServiceAccount()) });
const auth = getAuth(app);
const db = getFirestore(app);

async function findOrCreateAuthUser(email, data) {
  try {
    const existing = await auth.getUserByEmail(email);
    return { uid: existing.uid, created: false };
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || undefined;
  const createPayload = { email, displayName };

  if (typeof data.password === 'string' && data.password.length >= 6) {
    createPayload.password = data.password;
  }
  // Si no hay password (usuario que solo entraba con Google/Facebook) se crea
  // sin password: al iniciar sesion social de nuevo, Firebase Auth vincula la
  // cuenta existente por email automaticamente.

  const created = await auth.createUser(createPayload);
  return { uid: created.uid, created: true };
}

async function main() {
  console.log(APPLY ? '=== MODO APLICAR (se escribiran cambios reales) ===' : '=== MODO SIMULACION (dry-run, no se escribe nada) ===');

  const snapshot = await db.collection('users').get();
  console.log(`Documentos encontrados en 'users': ${snapshot.size}`);

  const seenEmails = new Map();
  let migrated = 0;
  let alreadyOk = 0;
  let skipped = 0;
  let errors = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const email = (data.email || '').trim().toLowerCase();
    const oldId = docSnap.id;

    if (!email) {
      console.warn(`[SKIP] ${oldId}: no tiene campo 'email', no se puede migrar.`);
      skipped++;
      continue;
    }

    if (seenEmails.has(email)) {
      console.warn(`[SKIP] ${oldId}: email '${email}' duplicado (ya procesado en doc ${seenEmails.get(email)}). Revisa manualmente.`);
      skipped++;
      continue;
    }
    seenEmails.set(email, oldId);

    try {
      const { uid, created } = APPLY
        ? await findOrCreateAuthUser(email, data)
        : await auth.getUserByEmail(email).then(u => ({ uid: u.uid, created: false })).catch(err => {
            if (err.code === 'auth/user-not-found') return { uid: '(se creara una nueva cuenta Auth)', created: true };
            throw err;
          });

      if (oldId === uid) {
        if ('password' in data) {
          console.log(`[LIMPIAR] ${oldId}: ya esta en el ID correcto, solo se quita el campo 'password'.`);
          if (APPLY) await db.collection('users').doc(oldId).update({ password: FieldValue.delete() });
        } else {
          console.log(`[OK] ${oldId}: ya migrado correctamente.`);
        }
        alreadyOk++;
        continue;
      }

      console.log(`[MIGRAR] ${oldId} (${email}) -> users/${uid} ${created ? '[cuenta Auth nueva]' : '[cuenta Auth existente]'}`);

      if (APPLY) {
        const { password, ...rest } = data;
        await db.collection('users').doc(uid).set(rest, { merge: true });
        await db.collection('users').doc(oldId).delete();
      }

      migrated++;
    } catch (error) {
      console.error(`[ERROR] ${oldId} (${email}):`, error.message || error);
      errors++;
    }
  }

  console.log('--- Resumen ---');
  console.log(`Migrados: ${migrated}`);
  console.log(`Ya estaban OK: ${alreadyOk}`);
  console.log(`Omitidos: ${skipped}`);
  console.log(`Errores: ${errors}`);
  if (!APPLY) {
    console.log('\nEsto fue una simulacion. Vuelve a correr con --apply para aplicar los cambios de verdad.');
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('Error fatal en la migracion:', error);
  process.exit(1);
});
