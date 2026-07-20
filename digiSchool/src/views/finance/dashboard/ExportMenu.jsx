import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export default function ExportMenu({ 
  dashboardRef,
  rawInvoices, rawPayments, rawExpenses,
  filteredInvoices, filteredPayments, filteredExpenses,
  activeFilters
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState('current'); // 'current' | 'full'
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    setIsOpen(false);

    try {
      // Temporarily add a class to adjust layout for printing if needed
      dashboardRef.current.classList.add('exporting-pdf');
      
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff' // Ensure white background
      });
      
      dashboardRef.current.classList.remove('exporting-pdf');

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate image dimensions to fit within PDF page
      const imgProps = pdf.getImageProperties(imgData);
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;

      // Add Header
      pdf.setFontSize(16);
      pdf.setTextColor(31, 41, 55); // #1f2937
      pdf.text('Finance Dashboard Snapshot', margin, margin + 5);
      
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128); // #6b7280
      const filterSummary = `Filters: Term: ${activeFilters.term} | Class: ${activeFilters.className}`;
      const timestamp = `Generated: ${new Date().toLocaleString()}`;
      pdf.text(`${filterSummary}  •  ${timestamp}`, margin, margin + 10);

      // Add Image
      // Ensure the snapshot doesn't bleed off the bottom of the page
      const finalHeight = Math.min(contentHeight, pdfHeight - (margin * 2) - 15);
      const finalWidth = (imgProps.width * finalHeight) / imgProps.height;
      
      // Center the image horizontally
      const xOffset = margin + ((contentWidth - finalWidth) / 2);

      pdf.addImage(imgData, 'JPEG', xOffset, margin + 15, finalWidth, finalHeight);
      
      pdf.save(`Finance_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF snapshot.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setIsOpen(false);
    
    try {
      const invoicesToExport = scope === 'current' ? filteredInvoices : rawInvoices;
      const paymentsToExport = scope === 'current' ? filteredPayments : rawPayments;
      const expensesToExport = scope === 'current' ? filteredExpenses : rawExpenses;

      // Prepare data for Excel
      const wb = XLSX.utils.book_new();

      // Sheet 1: Revenue (Payments)
      const revenueData = paymentsToExport.map(p => ({
        'Payment ID': p.id,
        'Date': new Date(p.created_at || p.date).toLocaleDateString(),
        'Student ID': p.student_id,
        'Method': p.method || 'Unknown',
        'Reference': p.ref || 'N/A',
        'Amount': Number(p.amount)
      }));
      const wsRevenue = XLSX.utils.json_to_sheet(revenueData);
      XLSX.utils.book_append_sheet(wb, wsRevenue, 'Revenue');

      // Sheet 2: Invoices (Billed)
      const invoiceData = invoicesToExport.map(i => ({
        'Invoice ID': i.id,
        'Issue Date': new Date(i.issue_date || i.created_at).toLocaleDateString(),
        'Student ID': i.student_id,
        'Term': i.term || 'N/A',
        'Amount Billed': Number(i.amount)
      }));
      const wsInvoices = XLSX.utils.json_to_sheet(invoiceData);
      XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices Billed');

      // Sheet 3: Expenses
      const expenseData = expensesToExport.map(e => ({
        'Expense ID': e.id,
        'Date': new Date(e.created_at || e.date).toLocaleDateString(),
        'Category': e.category,
        'Description': e.description || '',
        'Amount': Number(e.amount),
        'Status': e.status
      }));
      const wsExpenses = XLSX.utils.json_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

      // Save
      const filename = `Finance_Data_${scope === 'current' ? 'Filtered' : 'Full'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Failed to generate Excel data export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button 
        className="btn btn-outline" 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Download size={16} />
        {isExporting ? 'Exporting...' : 'Export'}
        <ChevronDown size={14} style={{ opacity: 0.6 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 280,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 50,
          overflow: 'hidden'
        }}>
          {/* Scope Toggle */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Data Scope
            </div>
            <div style={{ display: 'flex', background: 'var(--surface-raised)', borderRadius: 6, padding: 4, border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setScope('current')}
                style={{ 
                  flex: 1, 
                  padding: '6px 0', 
                  fontSize: 13, 
                  borderRadius: 4, 
                  background: scope === 'current' ? 'var(--primary)' : 'transparent',
                  color: scope === 'current' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: scope === 'current' ? 600 : 400
                }}
              >
                Current View
              </button>
              <button 
                onClick={() => setScope('full')}
                style={{ 
                  flex: 1, 
                  padding: '6px 0', 
                  fontSize: 13, 
                  borderRadius: 4, 
                  background: scope === 'full' ? 'var(--primary)' : 'transparent',
                  color: scope === 'full' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: scope === 'full' ? 600 : 400
                }}
              >
                Full Period
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
              {scope === 'current' 
                ? 'Exports data matching your active Slicer filters.' 
                : 'Ignores Slicers and exports all available records.'}
            </div>
          </div>

          {/* Export Options */}
          <div style={{ padding: 8 }}>
            <button 
              className="menu-item" 
              onClick={handleExportPDF}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
            >
              <div style={{ color: '#EF4444', background: '#EF444415', padding: 6, borderRadius: 6 }}><FileText size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Export as PDF</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Visual snapshot of the dashboard</div>
              </div>
            </button>

            <button 
              className="menu-item" 
              onClick={handleExportExcel}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
            >
              <div style={{ color: '#047857', background: '#04785715', padding: 6, borderRadius: 6 }}><FileSpreadsheet size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Export as Excel</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Raw transaction data (.xlsx)</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



