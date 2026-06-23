// describe: рендер выражения-ограничения в человекочитаемый текст (русский).
//
// ЧТО ДЕЛАЕТ  describe(e) — фраза, поясняющая предикат. Это интерпретатор над AST
//   (essensio/notation): тип остаётся чистым, текст ВЫВОДИТСЯ из структуры
//   выражения (а не хранится и не зашит в тип) — отдельная подсистема поверх.
//
// ВХОД   e: выражение (обычно предикат подтипа `T | <e>`).
// ВЫХОД  строка на русском.
//
// ПРИМЕРЫ
//   _ > 0 and _ < 100            → значение должно быть больше 0 и меньше 100
//   len(_) <= 80                 → длина значения не больше 80
//   _ ~ ["низкий", "высокий"]    → значение — одно из: «низкий», «высокий»
//   _ ~ r".+@.+"                 → значение соответствует шаблону «.+@.+»

import { nodes as N } from "@essensio/engine";

const CMP: Record<string, string> = {
  ">": "больше", "<": "меньше", ">=": "не меньше", "<=": "не больше", "=": "равно", "!=": "не равно",
};

export function describe(e: N.Expr): string {
  // частый случай: конъюнкция/дизъюнкция сравнений по `_` → выносим субъект
  if (allUnderscoreComparisons(e)) return "значение должно быть " + bare(e);
  return cond(e);
}

function allUnderscoreComparisons(e: N.Expr): boolean {
  if (e.kind !== "BinOp") return false;
  if (e.op === "and" || e.op === "or") {
    return allUnderscoreComparisons(e.left) && allUnderscoreComparisons(e.right);
  }
  return e.op in CMP && e.left.kind === "Underscore";
}

// предикат с вынесенным субъектом «значение»: «больше 0 и меньше 100»
function bare(e: N.Expr): string {
  if (e.kind === "BinOp") {
    if (e.op === "and") return bare(e.left) + " и " + bare(e.right);
    if (e.op === "or") return bare(e.left) + " или " + bare(e.right);
    if (e.op in CMP) return CMP[e.op] + " " + term(e.right);
  }
  return cond(e);
}

// общий случай: клаузы с явным субъектом
function cond(e: N.Expr): string {
  if (e.kind === "BinOp") {
    if (e.op === "and") return cond(e.left) + " и " + cond(e.right);
    if (e.op === "or") return cond(e.left) + " или " + cond(e.right);
    if (e.op === "~") return membership(subject(e.left), e.right);
    if (e.op in CMP) return subject(e.left) + " " + CMP[e.op] + " " + term(e.right);
  }
  if (e.kind === "UnOp" && e.op === "not") return "неверно, что " + cond(e.operand);
  return term(e);
}

function membership(subj: string, r: N.Expr): string {
  if (r.kind === "RelLit") return subj + " — одно из: " + r.elems.map(term).join(", ");
  if (r.kind === "Regex") return subj + " соответствует шаблону «" + r.pattern + "»";
  return subj + " входит в " + term(r);
}

// субъект сравнения: «значение», «длина значения», имя поля, …
function subject(e: N.Expr): string {
  if (e.kind === "Underscore") return "значение";
  if (e.kind === "Apply" && e.name === "len" && e.args.length === 1) {
    return e.args[0].kind === "Underscore" ? "длина значения" : "длина " + term(e.args[0]);
  }
  return term(e);
}

// значение-терм
function term(e: N.Expr): string {
  switch (e.kind) {
    case "Underscore": return "значение";
    case "Num": return e.text;
    case "Bool": return e.value ? "истина" : "ложь";
    case "Str": return "«" + e.value + "»";
    case "Regex": return "«" + e.pattern + "»";
    case "Ref": return e.name;
    case "Member": return term(e.obj) + "." + e.field;
    case "Apply":
      return e.name === "len" && e.args.length === 1
        ? subject(e)
        : e.name + "(" + e.args.map(term).join(", ") + ")";
    case "BinOp": return cond(e);
    case "UnOp": return e.op === "not" ? cond(e) : "-" + term(e.operand);
    case "TupleLit": return "{" + e.fields.map(([n, v]) => n + ": " + term(v)).join(", ") + "}";
    case "RelLit": return "[" + e.elems.map(term).join(", ") + "]";
    case "ScalarSel": return e.name + "(" + term(e.arg) + ")";
    case "RefSel": return "#" + e.target + "(" + term(e.arg) + ")";
    case "TupleSel": return e.name + term(e.value);
    case "RelSel": return e.name + term(e.value);
  }
}
