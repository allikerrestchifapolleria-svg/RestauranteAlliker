# Contexto: Integración Retell → n8n → Netlify (confirmación de reservas por voz)

> Documento de traspaso. Registra el estado de la integración de confirmación de
> reservas por voz al **30 de julio de 2026**, qué quedó hecho y qué falta.
> Fecha del último commit de referencia: `cebfd25 subiendo repo`.

---

## 1. Objetivo

Que una reserva **confirmada por voz** bloquee las mesas automáticamente en
Firestore, sin intervención manual.

Cadena completa:

```
Angular (reservations.ts)
   └─> n8n Workflow 2  ──> Retell (crea la llamada, devuelve access_token)
                              │
                              │ el cliente atiende, Daniela confirma o cancela
                              ▼
                          Retell Post-Call Analysis  → variable `asistencia`
                              │  (evento call_analyzed)
                              ▼
                          n8n Workflow 3
                              ├─> Google Sheets (historial, los 3 valores)
                              └─> Filtro: solo confirmado | cancelado
                                     └─> POST /api/confirm-reservation (Netlify)
                                            └─> Firestore: reserva + mesas
```

---

## 2. Estado actual

### ✅ Hecho

| Ítem | Detalle |
|---|---|
| Prompt de Daniela | Reescrito. Salida en `confirmado` / `cancelado` / `sin_respuesta` |
| `My workflow 3.json` | Transformado y commiteado. Nodo Firestore **eliminado**, reemplazado por HTTP a `confirm-reservation` + filtro `Solo confirmado o cancelado` |
| `My workflow 2.json` | Sin cambios estructurales. Puesto en `active: false` |
| `netlify/functions/confirm-reservation.ts` | Ya existe y valida correctamente |

### ❌ Pendiente

| # | Tarea | Dónde | Bloqueado por |
|---|---|---|---|
| 1 | Mover URL de n8n a `environment.ts` | `src/environments/environment.ts` | — |
| 2 | Eliminar el `fetch` roto | `reservations.ts:147` | — |
| 3 | Actualizar la URL de creación al dominio nuevo | `reservations.ts:291` | Production URL real |
| 4 | Reemplazar placeholder `TU-SITIO.netlify.app` | `My workflow 3.json` | Dominio de Netlify |
| 5 | Rellenar `x-webhook-secret` | En la UI de n8n, **no** en el archivo | Valor de `N8N_WEBHOOK_SECRET` |
| 6 | Cambiar `asistencia` de Text a **Selector** | Retell Post-Call Analysis | — |

---

## 3. El punto crítico: `asistencia` debe ser Selector, no Text

Hoy el campo está configurado como **Text** (campo libre). El `pinData` guardado
en el workflow tiene una respuesta real que lo demuestra:

```json
"asistencia": "Confirmada para Mesa 11, petición especial 'xd' registrada."
```

Eso es una frase entera. `confirm-reservation.ts:54` la rechaza con **400** y las
mesas nunca se bloquean:

```ts
if (status !== 'confirmado' && status !== 'cancelado') {
  return { statusCode: 400, body: JSON.stringify({ success: false,
    message: "status debe ser 'confirmado' o 'cancelado'" }) };
}
```

**El prompt sólo lo sugiere; el tipo de campo lo obliga.** Configuración correcta
en Retell → Post-Call Analysis:

| Campo | Valor |
|---|---|
| Name | `asistencia` |
| Type | **Selector** (no Text) |
| Options | `confirmado`, `cancelado`, `sin_respuesta` — sin tildes, con guion bajo |
| Optional | Apagado |

Retell no permite cambiar el tipo de un campo existente: hay que borrar el
`asistencia` actual (ícono de papelera) y recrearlo con `+ Add → Selector`.

---

## 4. El bug de `reservations.ts:147`

Dentro de `setupRetellEvents()`, en el handler de `conversationEnded`:

```ts
const status = asistencia ? 'Confirmada' : 'Cancelada';

// 🔥 ENVIO A N8N
await fetch('https://elanderyours.app.n8n.cloud/webhook/c74b22c2-...', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firebaseId: this.lastReservationId, status: status })
});
```

Está mal por tres motivos, y por eso **se elimina en vez de actualizarse**:

1. Apunta al webhook de **creación** (workflow 2), que espera el payload de una
   reserva nueva para pedirle un `access_token` a Retell — no un `{firebaseId, status}`.
2. Manda `"Confirmada"` / `"Cancelada"` (mayúscula, femenino) cuando la función
   espera `confirmado` / `cancelado`.
3. Es redundante: quien confirma la reserva ahora es el workflow 3, disparado por
   el evento `call_analyzed` de Retell. Este `fetch` duplica esa responsabilidad
   desde el navegador, que además puede cerrarse antes de que ejecute.

Sólo sobrevive el `fetch` de la **línea 291**, el que crea la reserva y obtiene el
`access_token`.

---

## 5. Migración de cuenta n8n

Se cambió de la cuenta personal a la del dueño:

```
elanderyours.app.n8n.cloud   →   alliker.app.n8n.cloud
```

### Lo que sobrevive al cambio

Los paths van dentro del JSON, así que al importar deberían conservarse:

- Workflow 2 → `/webhook/c74b22c2-7cc7-40de-b60f-629afc42052e`
- Workflow 3 → `/webhook/d1d7f164-7919-466f-9e8a-1308fb0c1a2f`

> ⚠️ **Verificar, no asumir.** Algunas versiones de n8n regeneran el id al
> importar. Abrir cada nodo Webhook y copiar la **Production URL** (`/webhook/...`),
> no la Test URL (`/webhook-test/...`, que sólo escucha una vez).

`https://alliker.app.n8n.cloud/home/workflows` es el panel, **no** la URL del webhook.

### Credenciales a recrear (no viajan en el JSON)

| Credencial | Usada en | Nota |
|---|---|---|
| Google Sheets OAuth2 | Workflows 2 y 3 | Compartir la hoja `T1_Machine` con la cuenta del dueño, permiso de edición |
| Retell (Header Auth) | Workflow 2, nodo HTTP | Requiere la API key de Retell otra vez |
| ~~Google Firestore (service account)~~ | ~~Workflow 3~~ | **Ya no hace falta** — el nodo se eliminó |

Esa última fila es la ganancia del rediseño: una cuenta de servicio sensible menos
que migrar, y toda la escritura a Firestore centralizada en la función de Netlify,
que ya valida el secreto y maneja las mesas.

---

## 6. Configuración del webhook en Retell

**Agent Level Webhook URL** → la Production URL del workflow 3.

**Eventos: marcar sólo `call_analyzed`.**

| Evento | ¿Marcar? | Por qué |
|---|---|---|
| `call_started` | No | No aporta nada al flujo |
| `call_ended` | No | Llega **sin** `call_analysis`, que es donde vive `asistencia` |
| `call_analyzed` | **Sí** | Trae `custom_analysis_data.asistencia` |

`call_ended` dispara apenas cuelga la llamada, cuando el análisis post-llamada
todavía no existe. `call_analyzed` llega unos segundos después, ya con el
resultado. Marcar los tres no rompe nada (el nodo Filter los descarta), pero son
ejecuciones de n8n desperdiciadas.

**Timeout de 5 s: está bien.** El nodo `Webhook1` no tiene `responseMode`
configurado, así que usa el default de n8n (`onReceived`): responde 200 de
inmediato y luego ejecuta el resto. Si algún día se cambia a "responder con el
último nodo", subirlo a 30 s — ahí Retell tendría que esperar a Google Sheets más
el arranque en frío de la función de Netlify (`firebase-admin` tarda en
inicializar).

> El workflow 3 debe estar **Active** en n8n. Con el workflow inactivo, la URL de
> producción devuelve 404 y no aparece ninguna ejecución.

---

## 7. Estructura del Workflow 3 (ya transformado)

```
Webhook1
  └─> Filter (event == "call_analyzed")
        └─> Update row in sheet          ← registra los 3 valores (historial)
              └─> Solo confirmado o cancelado   ← Filter, combinador OR
                    └─> Confirmar reserva y reservar mesa   ← HTTP Request
```

El filtro va **después** de Sheets a propósito: los tres valores quedan
registrados en la hoja como historial, pero sólo dos disparan la acción. Con
`sin_respuesta` el flujo se detiene ahí y la reserva se queda en `pending`, que es
lo correcto.

Nodo HTTP:

```
POST https://TU-SITIO.netlify.app/api/confirm-reservation
Header: x-webhook-secret
Body:   { firebaseId, status }
```

> 🔒 **El secreto se rellena en la UI de n8n, no en el archivo.** Estos JSON están
> versionados en git; escribirlo ahí lo deja en el historial del repo para
> siempre. Mejor aún: crear en n8n una credencial de tipo Header Auth y usarla en
> el nodo.

### Para probar sin gastar una llamada

El workflow conserva el `pinData` con un payload auténtico de Retell, con
`asistencia` cambiada a `confirmado` para que un "Execute workflow" recorra el
camino completo hasta la función. El `firebaseId` pinneado es
`8G1X2VVijJjbVg0fqxsK` — si esa reserva ya no existe en Firestore dará 404, que
igual confirma que la cadena llegó hasta el final.

---

## 8. Decisión pendiente en Workflow 2

El nodo `Code` calcula `fecha_alerta` como **la hora de la reserva menos 1 minuto**,
con el comentario `"para tu prueba de examen"`. Para uso real hay que subirlo
(¿2 h antes?). Se dejó como estaba por si todavía se está demostrando el sistema.

> Si la cuenta del dueño está en el plan gratuito de n8n, verificar que permita
> workflows activos con nodo **Wait** — el workflow 2 depende de esperar hasta
> `fecha_alerta`.

---

## 9. Orden de ejecución recomendado

1. El dueño crea la cuenta e importa ambos workflows en `alliker.app.n8n.cloud`.
2. Reconecta credenciales (Google Sheets OAuth2, Retell Header Auth) y comparte
   `T1_Machine`.
3. Anota las **Production URL** reales de ambos webhooks.
4. Recrea `asistencia` como **Selector** en Retell.
5. Rellena los dos placeholders del nodo HTTP (dominio Netlify + secreto).
6. Código Angular: URL a `environment.ts` y eliminar el `fetch` de la línea 147.
7. Actualiza el Agent Level Webhook URL en Retell al dominio nuevo.
8. Activa ambos workflows.

---

## 10. Apéndice: por qué fallaba el push a GitHub

No tenía relación con el `user.email` de los commits — eso es sólo metadato de
autoría, GitHub no lo mira para autorizar.

El problema era la **credencial cacheada** en Windows Credential Manager
(`AndersonBenitesKoW`) contra un repo de otra cuenta
(`allikerrestchifapolleria-svg`). GitHub responde `404 Repository not found` en
vez de `403` cuando un repo es privado y tu usuario no tiene acceso — lo hace a
propósito, para no confirmarle a un extraño que ese repo existe. De ahí el mensaje
engañoso. **Ya resuelto.**

Para futuros cambios de cuenta:

```bash
cmdkey /delete:LegacyGeneric:target=git:https://github.com
```

El siguiente `git push` vuelve a pedir login.
