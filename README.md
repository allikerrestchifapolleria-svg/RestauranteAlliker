# Alliker POS

Sistema integral de gestión para restaurante — Chifa — Pollería **Alliker**: portal público con carta digital y pedidos en línea, aplicación de mesero, pantalla de cocina en tiempo real y panel administrativo completo, con facturación electrónica SUNAT e impresión de tickets térmicos.

> Para la documentación técnica completa (arquitectura, modelo de datos, integraciones, despliegue, credenciales de prueba, etc.) ver **`Documentacion.docx`** en la raíz del repositorio.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21 (standalone components), TypeScript 5.9 |
| UI | Bootstrap 5.3, PrimeNG 21, PrimeFlex 4 |
| Backend / BD | Firebase Firestore (NoSQL, tiempo real) + Firebase Auth |
| Hosting | Netlify (SPA estática + Netlify Functions) |
| Pagos | Culqi Checkout v4 (tarjeta), Yape, efectivo |
| Facturación electrónica | XML UBL 2.1 (SUNAT), QR dinámico, `pdfmake` |
| IA | Retell AI + n8n (confirmación de reservas por voz) |
| Pruebas | Vitest (runner) + Jasmine/Karma (specs) |

## Módulos principales

- **Público** (`/`) — home, menú, platos, carrito, reservas, seguimiento de pedido, login/registro.
- **Mesero** (`/waiter`, rol `waiter`) — mesas, pedidos (Kanban) y cobro con facturación.
- **Cocina** (`/kitchen`, rol `cook`) — tablero de preparación en tiempo real.
- **Administrador** (`/admin`, rol `admin`) — menú, usuarios, sucursales, mesas, promociones, inventario, ventas, facturas, caja.

Cada módulo tiene su propio layout (`src/app/layouts/*-layout`) con identidad visual propia, y los guards de ruta (`src/app/guards/`) protegen cada sección según el rol del usuario autenticado.

## Desarrollo local

Instalar dependencias:

```bash
npm install
```

Configurar `src/environments/environment.ts` con las credenciales de Firebase y la clave pública de Culqi correspondientes al entorno.

Levantar el servidor de desarrollo:

```bash
ng serve
```

Abrir `http://localhost:4200/`. La app recarga automáticamente al modificar el código fuente.

## Build de producción

```bash
ng build
```

Genera los artefactos en `dist/restaurante/browser` (ruta de publicación usada por Netlify).

## Pruebas unitarias

```bash
ng test
```

Ejecuta las pruebas con el runner [Vitest](https://vitest.dev/).

## Despliegue

El proyecto se despliega en **Netlify**, con el repositorio conectado para despliegue continuo. La configuración de build vive en `netlify.toml`:

- Comando: `npm install && npm run build`
- Publish directory: `dist/restaurante/browser`
- Redirecciones: `/api/*` → Netlify Functions, `/*` → `index.html` (SPA)

Las funciones serverless (`netlify/functions/`) resuelven consultas de DNI/RUC (RENIEC/SUNAT) que no pueden hacerse directamente desde el navegador.

## Recursos adicionales

Para más información sobre Angular CLI, ver la [documentación oficial](https://angular.dev/tools/cli).
