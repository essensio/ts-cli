// control-hints: из типа поля → спецификация контрола формы. Интерпретатор над AST.
//
// ЧТО ДЕЛАЕТ  controlHints(t) — какой контрол и с какими границами рисовать для поля типа t.
//   Это подсказка ДЛЯ UI (форма), выводимая из структуры ограничения; тип остаётся
//   чистым. Авторитетная проверка значения — всё равно `checker`; здесь — лишь форма.
//
// ВХОД   t: семантический тип поля (возможно подтип с предикатом).
// ВЫХОД  { control, min?, max?, minLength?, maxLength?, options?, pattern? }.
//
// РАСПОЗНАЁТ (в конъюнкции ограничений): `_ >= a` / `_ <= b` → min/max;
//   `len(_) >= a` / `len(_) <= b` → minLength/maxLength (длина целочисленна: строгие
//   границы уточняются); `_ ~ [строки]` → select+options; `_ ~ r"…"` → pattern.
//   Нераспознанное (or, межполевое, …) в один контрол не сворачиваем — проверит checker.

import { root, type SemType } from "@essensio/engine";
import { nodes as N } from "@essensio/engine";

export type Control = "number" | "text" | "checkbox" | "date" | "time" | "select" | "group" | "list";

export type ControlHints = {
  control: Control;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  options?: string[];
  pattern?: string;
};

export function controlHints(t: SemType): ControlHints {
  const h: ControlHints = { control: controlOf(root(t)) };
  for (let cur = t; cur.kind === "Sub"; cur = cur.base) collect(cur.pred, h);
  if (h.options !== undefined) h.control = "select";
  return h;
}

function controlOf(base: SemType): Control {
  switch (base.kind) {
    case "Scalar":
      switch (base.name) {
        case "Число": return "number";
        case "Булево": return "checkbox";
        case "Дата": return "date";
        case "Время": return "time";
        default: return "text"; // Строка, UUID
      }
    case "RefT": return "text";
    case "Tup": return "group";
    case "Rel": return "list";
    case "Sub": return "text"; // недостижимо после root()
  }
}

function collect(e: N.Expr, h: ControlHints): void {
  if (e.kind !== "BinOp") return; // not / прочее — не отражаем в одном контроле
  if (e.op === "and") {
    collect(e.left, h);
    collect(e.right, h);
    return;
  }

  // _ ~ [строки] → варианты (select); _ ~ r"…" → шаблон
  if (e.op === "~" && e.left.kind === "Underscore") {
    if (e.right.kind === "RelLit" && e.right.elems.every((x) => x.kind === "Str")) {
      h.options = e.right.elems.map((x) => (x as N.Str).value);
    } else if (e.right.kind === "Regex") {
      h.pattern = e.right.pattern;
    }
    return;
  }

  if (e.right.kind !== "Num") return;
  const n = Number(e.right.text);

  // len(_) <op> N → длина (целое; строгие границы уточняем)
  if (isLenOfUnderscore(e.left)) {
    if (e.op === ">=") h.minLength = n;
    else if (e.op === ">") h.minLength = n + 1;
    else if (e.op === "<=") h.maxLength = n;
    else if (e.op === "<") h.maxLength = n - 1;
    return;
  }

  // _ <op> N → числовой диапазон (строгие границы — мягкая подсказка; точную проверку делает checker)
  if (e.left.kind === "Underscore") {
    if (e.op === ">=" || e.op === ">") h.min = n;
    else if (e.op === "<=" || e.op === "<") h.max = n;
  }
}

function isLenOfUnderscore(e: N.Expr): boolean {
  return e.kind === "Apply" && e.name === "len" && e.args.length === 1 && e.args[0].kind === "Underscore";
}
