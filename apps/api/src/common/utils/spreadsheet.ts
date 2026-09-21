export interface SpreadsheetRow {
  cells: (string | number | boolean | null | undefined)[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (typeof value === 'number') {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  if (typeof value === 'boolean') {
    return `<Cell><Data ss:Type="String">${value ? 'true' : 'false'}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
}

function rowXml(cells: (string | number | boolean | null | undefined)[]): string {
  return `<Row>${cells.map(cellXml).join('')}</Row>`;
}

/** Build a minimal Excel-compatible workbook (XML Spreadsheet 2003) without external deps. */
export function buildXmlSpreadsheet(
  sheetName: string,
  headers: string[],
  rows: SpreadsheetRow[],
): Buffer {
  const safeSheetName = escapeXml(sheetName.slice(0, 31));
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${safeSheetName}">
  <Table>
   ${rowXml(headers)}
   ${rows.map((row) => rowXml(row.cells)).join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf-8');
}
