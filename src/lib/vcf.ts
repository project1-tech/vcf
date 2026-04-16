export type SimpleContact = { name: string; phone: string };

export function buildVcf(contacts: SimpleContact[]): string {
  return contacts
    .map((c) => {
      const name = c.name.replace(/\r?\n/g, " ").trim();
      const phone = c.phone.replace(/\s+/g, "");
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${name};;;;`,
        `FN:${name}`,
        `TEL;TYPE=CELL:${phone}`,
        "END:VCARD",
      ].join("\r\n");
    })
    .join("\r\n");
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length <= 5) return digits;
  const head = digits.slice(0, digits.startsWith("+") ? 4 : 3);
  const tail = digits.slice(-2);
  const stars = "*".repeat(Math.max(4, digits.length - head.length - tail.length));
  return `${head}${stars}${tail}`;
}

export function downloadVcf(filename: string, vcf: string) {
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".vcf") ? filename : `${filename}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32);
  const rand = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${rand}` : rand;
}
