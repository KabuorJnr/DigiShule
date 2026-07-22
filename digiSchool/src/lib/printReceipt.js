import { fmtKES } from '../data/modules';

export function printReceipt(payment, student, schoolConfig) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  
  const html = `
    <html>
      <head>
        <title>Receipt - ${payment.id}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 40px;
          }
          .header {
            display: flex;
            align-items: center;
            border-bottom: 4px solid #f5b027;
            padding-bottom: 20px;
            margin-bottom: 30px;
            position: relative;
          }
          .header::after {
            content: '';
            position: absolute;
            bottom: -4px;
            right: 0;
            width: 70%;
            height: 4px;
            background: #1f2937;
          }
          .logo {
            width: 80px;
            height: 80px;
            background: #eee;
            margin-right: 20px;
            object-fit: contain;
          }
          .school-info h1 {
            margin: 0 0 5px 0;
            font-size: 20px;
            color: #1f2937;
          }
          .school-info p {
            margin: 0;
            font-size: 14px;
            color: #6b7280;
          }
          .title {
            text-align: center;
            font-size: 28px;
            font-weight: bold;
            margin: 40px 0 20px;
            color: #111827;
          }
          .meta {
            text-align: center;
            font-size: 14px;
            margin-bottom: 40px;
            color: #4b5563;
          }
          .grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          .box {
            width: 45%;
          }
          .box-title {
            background: #f3f4f6;
            padding: 10px;
            font-weight: bold;
            text-align: center;
            border-radius: 4px;
            margin-bottom: 15px;
          }
          .box-content {
            line-height: 1.6;
          }
          .table-container {
            margin-top: 40px;
          }
          .table-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background: #f9fafb;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #e5e7eb;
            color: #374151;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            color: #4b5563;
          }
          .total-row td {
            font-weight: bold;
            color: #111827;
            border-top: 2px solid #111827;
          }
          .footer {
            margin-top: 60px;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${schoolConfig?.logoUrl ? `<img src="${schoolConfig.logoUrl}" class="logo" />` : `<div class="logo" style="display:flex;align-items:center;justify-content:center;background:#1f2937;color:white;font-weight:bold;font-size:24px;">DS</div>`}
          <div class="school-info">
            <h1>${schoolConfig?.name || 'EduOne System'}</h1>
            <p>${schoolConfig?.address || ''}</p>
            <p>${schoolConfig?.phone || ''} | ${schoolConfig?.email || ''}</p>
          </div>
        </div>

        <div class="title">Cash Receipt</div>
        <div class="meta">
          <strong>Receipt Number:</strong> ${payment.id} &nbsp;|&nbsp; 
          <strong>Date:</strong> ${new Date(payment.created_at || payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Received From</div>
            <div class="box-content">
              <strong>${student?.name || 'Student'}</strong><br/>
              Admission: ${student?.adm || payment.adm || 'N/A'}<br/>
              Grade: ${student?.class || 'N/A'}
            </div>
          </div>
          <div class="box">
            <div class="box-title">Received By</div>
            <div class="box-content">
              <strong>Finance Department</strong><br/>
              ${schoolConfig?.name || 'EduOne System'}<br/>
              ${schoolConfig?.email || ''}
            </div>
          </div>
        </div>

        <div class="table-container">
          <div class="table-title">Transaction Details</div>
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Payment Method</th>
                <th>Reference</th>
                <th style="text-align: right;">Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>School Fees Payment</td>
                <td>${payment.method || 'M-Pesa'}</td>
                <td>${payment.ref || '—'}</td>
                <td style="text-align: right;">${fmtKES(payment.amount)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3">Total Amount</td>
                <td style="text-align: right;">${fmtKES(payment.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          Thank you for your payment. If you have any questions, please contact the finance office.
        </div>
      </body>
    </html>
  `;
  
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}
