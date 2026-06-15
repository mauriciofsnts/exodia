// Generators for fake-but-structurally-valid Brazilian documents and a test
// card. For test data only — the check digits are valid, the data is not real.

function randomDigits(length: number): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 10));
}

// Shared mod-11 check digit (CPF/CNPJ): weight runs high→low across the digits.
function mod11(digits: number[], startWeight: number): number {
  let weight = startWeight;
  let sum = 0;
  for (const digit of digits) {
    sum += digit * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function generateCpf(): string {
  const base = randomDigits(9);
  const d1 = mod11(base, 10);
  const d2 = mod11([...base, d1], 11);
  const all = [...base, d1, d2].join("");
  return all.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function generateCnpj(): string {
  // 8 random digits + "0001" headquarters branch + 2 check digits.
  const base = [...randomDigits(8), 0, 0, 0, 1];
  const d1 = mod11(base, 5);
  const d2 = mod11([...base, d1], 6);
  const all = [...base, d1, d2].join("");
  return all.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

// Luhn check digit for a number missing its final digit.
function luhnCheckDigit(digits: number[]): number {
  let sum = 0;
  const reversed = [...digits].reverse();
  for (let i = 0; i < reversed.length; i++) {
    // In the full number the check digit sits at the rightmost position, so each
    // existing digit shifts one left — double those at even reversed indices.
    let d = reversed[i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function generateCard(): string {
  // Mastercard: 16 digits starting 51–55, last digit Luhn-valid.
  const base = [5, 1 + Math.floor(Math.random() * 5), ...randomDigits(13)];
  const check = luhnCheckDigit(base);
  const all = [...base, check].join("");
  return all.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4");
}

export function generateRg(): string {
  // SP-style RG: 8 digits + a mod-11 check digit (which may be X).
  const base = randomDigits(8);
  const sum = base.reduce((acc, digit, i) => acc + digit * (i + 2), 0);
  const dvNum = 11 - (sum % 11);
  const dv = dvNum === 10 ? "X" : dvNum === 11 ? "0" : String(dvNum);
  return `${base.join("").replace(/(\d{2})(\d{3})(\d{3})/, "$1.$2.$3")}-${dv}`;
}

export function generateCep(): string {
  // CEP has no check digit — just a plausible 8-digit code.
  return randomDigits(8)
    .join("")
    .replace(/(\d{5})(\d{3})/, "$1-$2");
}
