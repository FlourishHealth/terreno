// jspdf relies on browser/node APIs (like latin1 encoding) unavailable in Hermes.
// On native platforms we stub it out so Metro can resolve the import
// from @terreno/ui without bundling the real library.
// PDF generation is web-only.
class jsPDF {}
module.exports = {jsPDF};
