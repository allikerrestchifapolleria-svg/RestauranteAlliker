const XLSX = require('xlsx');

const workbook = XLSX.readFile('SCRUM_DIARIO (1).xlsx');

const data = [

  ['Fecha', 'Que hice ayer', 'Que haré hoy', 'Impedimentos'],

];

const start = new Date('2026-04-02');

const end = new Date('2026-05-02');

let taskIndex = 0;

const tasks = [

  'Trabajé en la configuración inicial del admin layout.',

  'Implementé la autenticación en el admin layout.',

  'Agregué gestión de usuarios al admin layout.',

  'Desarrollé la gestión de menú en el admin layout.',

  'Trabajé en el pos layout: módulo de pedidos.',

  'Implementé la gestión de mesas en el pos layout.',

  'Agregué sincronización en tiempo real para pos layout.',

  'Continué con mejoras en el admin layout.',

  'Finalicé ajustes en el pos layout.',

  'Revisé y optimicé el admin layout.',

  'Actualicé el pos layout con nuevas funcionalidades.',

];

for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {

  const dateStr = d.toISOString().split('T')[0];

  const yesterday = tasks[taskIndex % tasks.length];

  const today = 'Continuar con el desarrollo de admin y pos layouts.';

  const impediments = 'Ninguno';

  data.push([dateStr, yesterday, today, impediments]);

  taskIndex++;

}

const worksheet = XLSX.utils.aoa_to_sheet(data);

XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Scrum');

XLSX.writeFile(workbook, 'SCRUM_DIARIO_updated.xlsx');