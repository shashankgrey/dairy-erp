import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportCustomersToExcel(customers) {
  const rows = customers.map((c) => ({
    Code: c.customer_code,
    Name: c.full_name,
    Mobile: c.mobile_number,
    Address: c.address || '',
    Email: c.email || '',

    // Total value of all purchases made by the customer
    'Total Amount': parseFloat(c.total_amount || 0),

    // Total payments received from the customer
    'Paid Amount': parseFloat(c.total_paid || 0),

    // Current outstanding balance
    'Outstanding Balance': parseFloat(c.outstanding_balance || 0),

    Status: c.active ? 'Active' : 'Archived',

    'Customer Since': c.created_at
      ? new Date(c.created_at).toLocaleDateString('en-IN')
      : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 12 }, // Code
    { wch: 22 }, // Name
    { wch: 14 }, // Mobile
    { wch: 28 }, // Address
    { wch: 22 }, // Email
    { wch: 16 }, // Total Amount
    { wch: 16 }, // Paid Amount
    { wch: 20 }, // Outstanding Balance
    { wch: 10 }, // Status
    { wch: 16 }, // Customer Since
  ];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Customers'
  );

  const dateStr = new Date()
    .toISOString()
    .split('T')[0];

  XLSX.writeFile(
    workbook,
    `customers-${dateStr}.xlsx`
  );
}


const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];


export function generateBillPDF(bill) {
  const doc = new jsPDF();

  const {
    customer,
    year,
    month,
    items,
    total,
    paidThisMonth,
  } = bill;

  doc.setFontSize(18);
  doc.setTextColor(15, 94, 76);
  doc.text('Dairy ERP', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);

  doc.text(
    `Monthly Bill — ${MONTH_NAMES[month - 1]} ${year}`,
    14,
    26
  );

  doc.setDrawColor(220, 220, 220);
  doc.line(14, 31, 196, 31);

  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);

  doc.text(
    `Customer: ${customer.full_name} (${customer.customer_code})`,
    14,
    39
  );

  doc.text(
    `Mobile: ${customer.mobile_number}`,
    14,
    45
  );

  if (customer.address) {
    doc.text(
      `Address: ${customer.address}`,
      14,
      51
    );
  }

  autoTable(doc, {
    startY: 58,

    head: [
      [
        'Product',
        'Quantity',
        'Avg. Rate',
        'Subtotal',
      ],
    ],

    body: items.map((i) => [
      i.product,
      `${i.quantity} ${i.unit}`,
      `Rs. ${i.avg_price}`,
      `Rs. ${i.subtotal}`,
    ]),

    headStyles: {
      fillColor: [15, 94, 76],
    },

    styles: {
      fontSize: 10,
    },
  });

  const finalY = doc.lastAutoTable.finalY + 12;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');

  doc.text(
    `Total for the month: Rs. ${total}`,
    14,
    finalY
  );

  doc.setFont(undefined, 'normal');

  doc.setFontSize(10);

  doc.text(
    `Paid this month: Rs. ${paidThisMonth}`,
    14,
    finalY + 8
  );

  doc.text(
    `Outstanding balance (overall): Rs. ${customer.outstanding_balance}`,
    14,
    finalY + 15
  );

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);

  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-IN')}`,
    14,
    285
  );

  doc.save(
    `bill-${customer.customer_code}-${year}-${String(month).padStart(2, '0')}.pdf`
  );
}


// Full itemized daily report: customer sales, collections, supplier
// stock purchases, supplier payments, plus the money-position summary
// (receivables/payables/net). Mirrors generateBillPDF's branding
// (dairy-green header, autoTable sections) so downloads look
// consistent across the app.
export function generateDailyReportPDF(report) {
  const doc = new jsPDF();
  const {
    date,
    sales,
    collections,
    stockPurchases,
    supplierPayments,
    receivables,
    payables,
    netReceivable,
  } = report;

  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  doc.setFontSize(18);
  doc.setTextColor(15, 94, 76);
  doc.text('Dairy ERP', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Daily Report — ${formattedDate}`, 14, 26);

  doc.setDrawColor(220, 220, 220);
  doc.line(14, 31, 196, 31);

  let cursorY = 40;

  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`Customer Receivables: Rs. ${receivables}`, 14, cursorY);
  doc.text(`Supplier Payables: Rs. ${payables}`, 14, cursorY + 6);
  doc.setFont(undefined, 'bold');
  doc.text(`Net Receivable: Rs. ${netReceivable}`, 14, cursorY + 13);
  doc.setFont(undefined, 'normal');

  cursorY += 24;

  function ensureSpace(needed) {
    if (cursorY + needed > 280) {
      doc.addPage();
      cursorY = 20;
    }
  }

  function section(title, head, rows) {
    if (rows.length === 0) return;

    ensureSpace(20);
    doc.setFontSize(11);
    doc.setTextColor(15, 94, 76);
    doc.setFont(undefined, 'bold');
    doc.text(title, 14, cursorY);
    doc.setFont(undefined, 'normal');

    autoTable(doc, {
      startY: cursorY + 4,
      head: [head],
      body: rows,
      headStyles: { fillColor: [15, 94, 76] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    cursorY = doc.lastAutoTable.finalY + 12;
  }

  section(
    `Customer Sales (${sales.entries} entries — Rs. ${sales.total})`,
    ['Customer', 'Product', 'Qty', 'Rate', 'Amount'],
    sales.items.map((s) => [
      s.customer_name,
      s.product_name,
      `${s.quantity} ${s.unit}`,
      `Rs. ${s.unit_price}`,
      `Rs. ${s.total_amount}`,
    ])
  );

  section(
    `Customer Collections (Rs. ${collections.total})`,
    ['Customer', 'Method', 'Amount', 'Notes'],
    collections.items.map((c) => [
      c.customer_name,
      c.payment_method.toUpperCase(),
      `Rs. ${c.amount}`,
      c.notes || '-',
    ])
  );

  section(
    `Supplier Stock Purchases (${stockPurchases.entries} entries — Rs. ${stockPurchases.total})`,
    ['Supplier', 'Product', 'Qty', 'Cost/Unit', 'Amount'],
    stockPurchases.items.map((s) => [
      s.supplier_name,
      s.product_name,
      `${s.quantity} ${s.unit}`,
      `Rs. ${s.unit_cost}`,
      `Rs. ${s.total_amount}`,
    ])
  );

  section(
    `Supplier Payments (Rs. ${supplierPayments.total})`,
    ['Supplier', 'Method', 'Amount', 'Reference'],
    supplierPayments.items.map((s) => [
      s.supplier_name,
      s.payment_method.toUpperCase(),
      `Rs. ${s.amount}`,
      s.reference_number || '-',
    ])
  );

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-IN')}`,
    14,
    290
  );

  doc.save(`daily-report-${date}.pdf`);
}