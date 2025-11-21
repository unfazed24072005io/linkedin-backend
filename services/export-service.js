const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportToCSV(leads) {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = Date.now();
        const filePath = path.join(this.exportDir, `leads-${timestamp}.csv`);
        
        const csvWriter = createCsvWriter({
          path: filePath,
          header: [
            { id: 'name', title: 'Name' },
            { id: 'title', title: 'Job Title' },
            { id: 'company', title: 'Company' },
            { id: 'location', title: 'Location' },
            { id: 'email', title: 'Email' },
            { id: 'phone', title: 'Phone' },
            { id: 'profileUrl', title: 'LinkedIn URL' }
          ]
        });

        // Clean data for CSV export
        const cleanedLeads = leads.map(lead => ({
          name: lead.name || 'Not Available',
          title: lead.title || 'Not Available',
          company: lead.company || 'Not Available',
          location: lead.location || 'Not Available',
          email: lead.email || 'Not available',
          phone: lead.phone || 'Not available',
          profileUrl: lead.profileUrl || 'Not Available'
        }));

        csvWriter.writeRecords(cleanedLeads)
          .then(() => {
            console.log(`CSV exported successfully: ${filePath}`);
            resolve(filePath);
          })
          .catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  async exportToExcel(leads) {
    return new Promise(async (resolve, reject) => {
      try {
        const timestamp = Date.now();
        const filePath = path.join(this.exportDir, `leads-${timestamp}.xlsx`);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('LinkedIn Leads');

        // Define columns
        worksheet.columns = [
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Job Title', key: 'title', width: 30 },
          { header: 'Company', key: 'company', width: 25 },
          { header: 'Location', key: 'location', width: 20 },
          { header: 'Email', key: 'email', width: 25 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'LinkedIn URL', key: 'profileUrl', width: 40 }
        ];

        // Clean data for Excel export
        const cleanedLeads = leads.map(lead => ({
          name: lead.name || 'Not Available',
          title: lead.title || 'Not Available',
          company: lead.company || 'Not Available',
          location: lead.location || 'Not Available',
          email: lead.email || 'Not available',
          phone: lead.phone || 'Not available',
          profileUrl: lead.profileUrl || 'Not Available'
        }));

        // Add data rows
        worksheet.addRows(cleanedLeads);

        // Style header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0077B5' }
        };

        // Style data rows - highlight contact info
        cleanedLeads.forEach((lead, index) => {
          const row = worksheet.getRow(index + 2);
          
          if (lead.email !== 'Not available') {
            row.getCell('email').font = { bold: true, color: { argb: 'FF2E8B57' } };
          }
          
          if (lead.phone !== 'Not available') {
            row.getCell('phone').font = { bold: true, color: { argb: 'FF2E8B57' } };
          }
        });

        // Add auto filters
        worksheet.autoFilter = {
          from: 'A1',
          to: 'G1'
        };

        await workbook.xlsx.writeFile(filePath);
        console.log(`Excel exported successfully: ${filePath}`);
        resolve(filePath);

      } catch (error) {
        reject(error);
      }
    });
  }

  // Quick export for immediate download (simple CSV)
  quickExportCSV(leads) {
    const headers = ['Name', 'Job Title', 'Company', 'Location', 'Email', 'Phone', 'LinkedIn URL'];
    
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => [
        `"${lead.name || 'Not Available'}"`,
        `"${lead.title || 'Not Available'}"`,
        `"${lead.company || 'Not Available'}"`,
        `"${lead.location || 'Not Available'}"`,
        `"${lead.email || 'Not available'}"`,
        `"${lead.phone || 'Not available'}"`,
        `"${lead.profileUrl || 'Not Available'}"`
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Clean up old export files
  cleanupOldExports(maxAgeHours = 24) {
    const files = fs.readdirSync(this.exportDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(this.exportDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old export: ${file}`);
      }
    });
  }
}

module.exports = new ExportService();