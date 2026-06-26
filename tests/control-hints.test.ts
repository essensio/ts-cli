// Тесты controlHints: тип поля → спецификация контрола формы (выводится из AST).

import assert from "node:assert/strict";
import { describe as suite, test } from "node:test";

import { controlHints } from "../src/control-hints";
import { Env } from "@essensio/engine";

function hints(decls: string[], name: string) {
  const env = new Env();
  for (const d of decls) env.declare(d);
  const t = env.types.get(name);
  if (t === undefined) throw new Error(`нет типа ${name}`);
  return controlHints(t);
}

suite("controlHints", () => {
  test("длина строки → text + minLength/maxLength", () => {
    assert.deepStrictEqual(
      hints(["Название = Строка & len(_) >= 1 and len(_) <= 80"], "Название"),
      { control: "text", minLength: 1, maxLength: 80 },
    );
  });

  test("строгие границы длины уточняются целочисленно", () => {
    assert.deepStrictEqual(
      hints(["T = Строка & len(_) > 0 and len(_) < 10"], "T"),
      { control: "text", minLength: 1, maxLength: 9 },
    );
  });

  test("числовой диапазон → number + min/max", () => {
    assert.deepStrictEqual(
      hints(["Процент = Число & _ >= 0 and _ <= 100"], "Процент"),
      { control: "number", min: 0, max: 100 },
    );
  });

  test("перечисление → select + options", () => {
    assert.deepStrictEqual(
      hints(['Приоритет = Строка & _ ~ ["низкий", "средний", "высокий"]'], "Приоритет"),
      { control: "select", options: ["низкий", "средний", "высокий"] },
    );
  });

  test("регэксп → text + pattern", () => {
    assert.deepStrictEqual(
      hints(['Почта = Строка & _ ~ r".+@.+"'], "Почта"),
      { control: "text", pattern: ".+@.+" },
    );
  });

  test("базовые контролы без ограничения", () => {
    assert.deepStrictEqual(hints(["Флаг = Булево"], "Флаг"), { control: "checkbox" });
    assert.deepStrictEqual(hints(["Когда = Дата"], "Когда"), { control: "date" });
  });

  test("объединение → text (единого контроля нет; проверит checker)", () => {
    assert.deepStrictEqual(hints(["Срок = Дата | Пусто"], "Срок"), { control: "text" });
  });
});
