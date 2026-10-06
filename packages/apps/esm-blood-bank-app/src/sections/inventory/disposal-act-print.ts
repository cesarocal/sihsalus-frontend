/** Included only in the EG010-FR02 print iframe, never in the application stylesheet. */
export const disposalActPrintCss = `
  @page {
    size: A4 portrait; margin: 14mm;
    @top-right { content: counter(page) " / " counter(pages); font: 8pt Arial, sans-serif; }
  }
  [data-disposal-act] { max-width: none; font: 10pt Arial, sans-serif; }
  [data-disposal-act] h2 { text-align: left; font-size: 13pt; margin: 0 0 9mm; text-transform: uppercase; }
  [data-disposal-act] [data-act-date] { margin: 0 0 3mm; line-height: 1.7; }
  [data-disposal-act] [data-act-witnesses] { margin: 0 0 4mm; min-height: 16mm; line-height: 6mm; border-bottom: 1px solid #111; }
  [data-disposal-act] [data-act-introduction] { margin: 0 0 4mm; line-height: 1.5; }
  [data-disposal-act] table { table-layout: fixed; font-size: 9pt; width: 100%; }
  [data-disposal-act] thead { display: table-header-group; }
  [data-disposal-act] tr { break-inside: avoid; }
  [data-disposal-act] th, [data-disposal-act] td { border: 1px solid #111; padding: 1mm; vertical-align: middle; }
  [data-disposal-act] th { text-align: center; height: 12mm; font-weight: bold; background: white; }
  [data-disposal-act] td { height: 5.7mm; box-sizing: border-box; }
  [data-disposal-act] td:nth-child(2), [data-disposal-act] td:nth-child(3) { text-align: center; }
  [data-disposal-act] footer { border: 0; padding: 0; margin-top: 10mm; break-inside: avoid; }
  [data-disposal-act] [data-signature] { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: 4mm; margin: 0 0 12mm; align-items: start; }
  [data-disposal-act] [data-signature-name] { border-top: 1px solid #111; text-align: center; padding-top: 2mm; }
  [data-disposal-act] [data-demo] { border: 0; font-size: 7pt; padding: 0; margin: 0 0 3mm; }
  [data-disposal-act] [data-act-draft] { font-size: 8pt; margin: 0 0 2mm; }
`;
