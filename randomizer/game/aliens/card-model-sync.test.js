const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const ALIEN_CARD_MODELS = Object.freeze([
  Object.freeze({
    alien: "异常点",
    modulePath: "./yichangdian",
    cardPrefix: "yichangdian",
  }),
  Object.freeze({
    alien: "半人马",
    modulePath: "./banrenma",
    cardPrefix: "banrenma",
  }),
  Object.freeze({
    alien: "虫",
    modulePath: "./chong",
    cardPrefix: "chong",
  }),
  Object.freeze({
    alien: "阿米巴",
    modulePath: "./amiba",
    cardPrefix: "amiba",
  }),
  Object.freeze({
    alien: "奥陌陌",
    modulePath: "./aomomo",
    cardPrefix: "aomomo",
  }),
  Object.freeze({
    alien: "符文族",
    modulePath: "./runezu",
    cardPrefix: "runezu",
  }),
]);

const INTEGER_FIELDS = new Set([
  "price",
  "card_type_code",
  "scan_action_code",
  "income_code",
]);

function decodeCsvFile(filePath) {
  const data = fs.readFileSync(filePath);
  for (const encoding of ["utf-8", "gb18030"]) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(data);
    } catch (_error) {
      // Try the next known source encoding.
    }
  }
  throw new Error(`Cannot decode CSV: ${filePath}`);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
    } else if (character === "\"") {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const header = rows.shift().map((name, index) => (
    index === 0 ? name.replace(/^\uFEFF/, "") : name
  ));
  return rows
    .filter((fields) => fields.some((value) => value !== ""))
    .map((fields) => Object.fromEntries(header.map((name, index) => {
      const value = fields[index] ?? "";
      return [name, INTEGER_FIELDS.has(name) ? Number(value) : value];
    })));
}

function getIndexFromAsset(asset) {
  const match = String(asset || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeCsvRow(row, cardPrefix) {
  return {
    index: getIndexFromAsset(row.card_id),
    cardId: `${cardPrefix}_${row.card_id}`,
    asset: row.card_id,
    cardName: row.card_name,
    price: row.price,
    cardTypeCode: row.card_type_code,
    discardActionCode: /^\d+$/.test(String(row.discard_action_code))
      ? Number(row.discard_action_code)
      : row.discard_action_code,
    scanActionCode: row.scan_action_code,
    incomeCode: row.income_code,
  };
}

function normalizeDefinition(definition, cardPrefix) {
  return {
    index: definition.index,
    cardId: definition.cardId,
    asset: definition.asset || String(definition.cardId || "").replace(`${cardPrefix}_`, ""),
    cardName: definition.cardName,
    price: definition.price,
    cardTypeCode: definition.cardTypeCode,
    discardActionCode: definition.discardActionCode,
    scanActionCode: definition.scanActionCode,
    incomeCode: definition.incomeCode,
  };
}

for (const config of ALIEN_CARD_MODELS) {
  const csvPath = path.resolve(
    __dirname,
    "../../../assets/aliens",
    config.alien,
    "card_model.csv",
  );
  const csvDefinitions = parseCsvRows(decodeCsvFile(csvPath))
    .map((row) => normalizeCsvRow(row, config.cardPrefix));
  const runtimeDefinitions = require(config.modulePath).CARD_DEFINITIONS
    .map((definition) => normalizeDefinition(definition, config.cardPrefix));

  assert.deepEqual(
    runtimeDefinitions,
    csvDefinitions,
    `${config.alien} CARD_DEFINITIONS should match assets/aliens/${config.alien}/card_model.csv`,
  );
}

console.log("alien card model sync tests passed");
