// pdf.js — generación de ticket PDF con jsPDF (cargado via CDN)

function generarTicketPDF(envio) {
  if (!window.jspdf) { alert('jsPDF no está cargado'); return; }
  const { jsPDF } = window.jspdf;

  // Formato ticket térmico 80mm
  const doc = new jsPDF({ unit: 'mm', format: [80, 170] });
  const W = 80;
  let y = 0;

  const hr = (dash = false) => {
    doc.setDrawColor(160);
    if (dash) doc.setLineDash([1, 1.5]);
    doc.line(4, y, W - 4, y);
    doc.setLineDash([]);
    y += 5;
  };

  const txt = (text, x, size = 8, bold = false, align = 'left') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (align === 'center') {
      doc.text(text, W / 2, y, { align: 'center' });
    } else {
      doc.text(text, x, y);
    }
  };

  const row = (label, valor, size = 8) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(label, 4, y);
    doc.setFont('helvetica', 'normal');
    const v = String(valor ?? '—');
    const lines = doc.splitTextToSize(v, 42);
    doc.text(lines, 36, y);
    y += lines.length * (size * 0.38) + 2;
  };

  // ── Encabezado ────────────────────────────────────────
  y = 8;
  txt('PAQUETERIA COLOTLAN AP', 0, 10, true, 'center'); y += 5;
  txt('Colotlan, Jalisco · CP 46200', 0, 7, false, 'center'); y += 4;
  txt('Tel. 499-123-4567', 0, 7, false, 'center'); y += 5;
  hr(true);

  // ── Número de guía ────────────────────────────────────
  txt('GUIA DE ENVIO', 0, 8, true, 'center'); y += 5;
  txt(envio.guia || '—', 0, 12, true, 'center'); y += 7;
  hr();

  // ── Carrier + servicio ────────────────────────────────
  row('Paqueteria:', envio.carrier);
  row('Servicio:', envio.servicio || '—');
  row('Entrega est.:', envio.entregaEstimada || '—');
  row('Modo:', envio.modo_entrega === 'recoleccion' ? 'Recoleccion a domicilio' : 'Entrega en oficina');
  y += 1;
  hr();

  // ── Remitente ─────────────────────────────────────────
  txt('REMITENTE', 4, 8, true); y += 5;
  row('Nombre:', envio.remitente_nombre);
  row('Tel:', envio.remitente_telefono);
  row('CP origen:', envio.cp_origen || '46200');
  y += 1;
  hr();

  // ── Destinatario ──────────────────────────────────────
  txt('DESTINATARIO', 4, 8, true); y += 5;
  row('Nombre:', envio.destinatario_nombre);
  row('Tel:', envio.destinatario_telefono);
  if (envio.destinatario_calle) row('Calle:', envio.destinatario_calle);
  if (envio.destinatario_colonia) row('Colonia:', envio.destinatario_colonia);
  row('Ciudad:', envio.ciudad_destino || envio.cp_destino);
  row('CP destino:', envio.cp_destino);
  if (envio.destinatario_referencias) row('Ref:', envio.destinatario_referencias);
  y += 1;
  hr();

  // ── Paquete ───────────────────────────────────────────
  if (envio.articulo) row('Contenido:', envio.articulo);
  if (envio.peso)     row('Peso:', `${envio.peso} kg`);
  if (envio.seguro)   row('Valor decl.:', `$${Number(envio.seguro).toFixed(0)} MXN`);
  y += 1;
  hr(true);

  // ── Total ─────────────────────────────────────────────
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 4, y);
  doc.text(`$${Number(envio.precio).toFixed(2)} MXN`, W - 4, y, { align: 'right' });
  y += 5;
  const pago = envio.metodo_pago === 'efectivo' ? 'Efectivo' : 'Transferencia';
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Forma de pago: ${pago}`, 4, y); y += 6;
  hr(true);

  // ── Footer ────────────────────────────────────────────
  doc.setTextColor(120);
  txt('Gracias por su preferencia', 0, 7, false, 'center'); y += 4;
  txt(new Date().toLocaleString('es-MX'), 0, 6, false, 'center');
  doc.setTextColor(0);

  doc.save(`ticket-${envio.guia}.pdf`);
}
