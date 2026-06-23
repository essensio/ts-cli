// Тесты describe: предикат-ограничение → человекочитаемый текст (выводится из AST).

import assert from "node:assert/strict";
import { describe as suite, test } from "node:test";

import { describe } from "../src/describe";
import { parseExpression } from "@essensio/engine";

suite("describe", () => {
  const d = (s: string): string => describe(parseExpression(s));

  test("диапазон по _", () => {
    assert.equal(d("_ > 0 and _ < 100"), "значение должно быть больше 0 и меньше 100");
  });

  test("длина строки", () => {
    assert.equal(d("len(_) <= 80"), "длина значения не больше 80");
    assert.equal(d("len(_) >= 1 and len(_) <= 80"),
      "длина значения не меньше 1 и длина значения не больше 80");
  });

  test("перечисление", () => {
    assert.equal(d('_ ~ ["низкий", "средний", "высокий"]'),
      "значение — одно из: «низкий», «средний», «высокий»");
  });

  test("регэксп", () => {
    assert.equal(d('_ ~ r".+@.+"'), "значение соответствует шаблону «.+@.+»");
  });

  test("по полям кортежа", () => {
    assert.equal(d("ширина >= высота"), "ширина не меньше высота");
  });
});
