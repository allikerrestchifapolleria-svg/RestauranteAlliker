const UNIDADES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE',
];

const DECENAS = [
  '', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

function convertirCentenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let str = CENTENAS[c] || '';
  if (resto > 0) {
    str += ' ' + convertirDecenas(resto);
  }
  return str.trim();
}

function convertirDecenas(n: number): string {
  if (n === 0) return '';
  if (n <= 20) return UNIDADES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 2 && u > 0) return 'VEINTI' + UNIDADES[u];
  let str = DECENAS[d] || '';
  if (u > 0) str += ' Y ' + UNIDADES[u];
  return str.trim();
}

function convertirMiles(n: number): string {
  if (n === 0) return '';
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  let str = '';
  if (miles === 1) {
    str = 'MIL';
  } else if (miles > 1) {
    str = convertirCentenas(miles) + ' MIL';
  }
  if (resto > 0) {
    str += ' ' + convertirCentenas(resto);
  }
  return str.trim();
}

function convertirMillones(n: number): string {
  const millones = Math.floor(n / 1000000);
  const resto = n % 1000000;
  let str = '';
  if (millones === 1) {
    str = 'UN MILLÓN';
  } else if (millones > 1) {
    str = convertirMiles(millones) + ' MILLONES';
  }
  if (resto > 0) {
    str += ' ' + convertirMiles(resto);
  }
  return str.trim();
}

export function numeroALetras(monto: number): string {
  if (monto === 0) return 'CERO';

  const entero = Math.floor(monto);
  const decimales = Math.round((monto - entero) * 100);

  let str = '';
  if (entero >= 1000000) {
    str = convertirMillones(entero);
  } else if (entero >= 1000) {
    str = convertirMiles(entero);
  } else {
    str = convertirCentenas(entero);
  }

  const decStr = decimales.toString().padStart(2, '0');
  return `${str} CON ${decStr}/100`;
}
