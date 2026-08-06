const XLSX = require('xlsx');

const file = process.argv[2];

const workbook = XLSX.readFile(file);

const sheetName = workbook.SheetNames[0];

const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, {header:1});

console.log(JSON.stringify(data));