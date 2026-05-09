/* pdf.js — generación de ticket PDF con jsPDF (client-side) */

// jsPDF se carga via CDN en el HTML: <script src="https://cdnjs.cloudflare.com/.../jspdf.umd.min.js">

export function generarTicket(envio) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a6' });

  const { pageSize } = doc.internal;
  const W = pageSize.getWidth();

  // Encabezado
  doc.setFillColor(13, 27, 62);   // --navy
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Paquetería Colotlán AP', W / 2, 14, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Colotlán, Jalisco · CP 46200', W / 2, 22, { align: 'center' });

  // Datos de guía
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(10);
  let y = 38;

  const linea = (label, valor) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 8, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(valor ?? '—'), 50, y);
    y += 7;
  };

  linea('Guía:', envio.guia);
  linea('Carrier:', envio.carrier);
  linea('Servicio:', envio.servicio);
  linea('Origen CP:', envio.cp_origen || '46200');
  linea('Destino CP:', envio.cp_destino);
  linea('Destinatario:', envio.destinatario_nombre);
  linea('Teléfono:', envio.destinatario_telefono);
  linea('Dirección:', envio.destinatario_calle);
  linea('Ciudad:', envio.ciudad_destino);
  linea('Peso:', `${envio.peso} kg`);
  linea('Precio:', `$${Number(envio.precio).toFixed(2)} MXN`);
  linea('Pago:', envio.metodo_pago);

  // Separador
  doc.setDrawColor(220, 220, 220);
  doc.line(8, y, W - 8, y);
  y += 6;

  // Artículo
  linea('Artículo:', envio.articulo);

  // Pie
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Emitido: ${new Date().toLocaleString('es-MX')}`, W / 2, y + 8, { align: 'center' });

  doc.save(`ticket-${envio.guia}.pdf`);
}
