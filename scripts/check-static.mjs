import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const failures = [];

function relative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : walk(fullPath);
    }
    return entry.isFile() ? [fullPath] : [];
  });
}

function fail(filePath, message) {
  failures.push(`${relative(filePath)}: ${message}`);
}

function checkJavaScript(source, label, filePath) {
  try {
    new vm.Script(source, { filename: label });
  } catch (error) {
    fail(filePath, `JavaScript tidak valid (${error.message})`);
  }
}

function isLocalReference(value) {
  if (!value || value.startsWith("#") || value.startsWith("//")) return false;
  if (/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(value)) return false;
  return !/[{}`]/.test(value);
}

function resolveReference(htmlFile, reference) {
  const cleanReference = reference.split("#", 1)[0].split("?", 1)[0];
  if (!cleanReference) return null;

  if (cleanReference.startsWith("/Kpp-fms/")) {
    return path.join(projectRoot, cleanReference.slice("/Kpp-fms/".length));
  }
  if (cleanReference.startsWith("/")) return null;
  return path.resolve(path.dirname(htmlFile), cleanReference);
}

const files = walk(projectRoot);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const jsFiles = files.filter((file) => file.endsWith(".js"));
let inlineScriptCount = 0;
let localReferenceCount = 0;

for (const jsFile of jsFiles) {
  const source = fs.readFileSync(jsFile, "utf8");
  checkJavaScript(source, relative(jsFile), jsFile);

  if (/\bservice[_-]?role\b|sb_secret_[A-Za-z0-9_-]*/i.test(source)) {
    fail(jsFile, "indikasi secret/server key ditemukan");
  }
}

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  if (!/^\s*<!doctype html>/i.test(html)) {
    fail(htmlFile, "DOCTYPE HTML tidak ditemukan");
  }

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    const attributes = match[1] || "";
    const source = match[2] || "";
    if (/\bsrc\s*=/i.test(attributes) || !source.trim()) return;

    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !["text/javascript", "application/javascript"].includes(type)) return;

    inlineScriptCount += 1;
    checkJavaScript(source, `${relative(htmlFile)}#inline-${index + 1}`, htmlFile);
  });

  const references = [...html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)];
  for (const match of references) {
    const reference = match[2].trim();
    if (!isLocalReference(reference)) continue;

    const target = resolveReference(htmlFile, reference);
    if (!target) continue;
    localReferenceCount += 1;
    if (!fs.existsSync(target)) {
      fail(htmlFile, `referensi lokal tidak ditemukan (${reference})`);
    }
  }

  if (/\bservice[_-]?role\b|sb_secret_[A-Za-z0-9_-]*/i.test(html)) {
    fail(htmlFile, "indikasi secret/server key ditemukan");
  }
}

const authPath = path.join(projectRoot, "auth.js");
const authSource = fs.readFileSync(authPath, "utf8");
if (/class="kpp-user-(?:name|role)"[^>]*>\s*\$\{/i.test(authSource)) {
  fail(authPath, "data profil kembali dirender langsung melalui innerHTML");
}
if (!authSource.includes("userName.textContent = displayName")) {
  fail(authPath, "pengaman textContent untuk nama profil tidak ditemukan");
}

const fillingPath = path.join(projectRoot, "pengisian.html");
const fillingSource = fs.readFileSync(fillingPath, "utf8");
const hmHelperCount = fillingSource.match(/function\s+hmOperationalKey\s*\(/g)?.length ?? 0;
if (hmHelperCount !== 1) {
  fail(fillingPath, `hmOperationalKey harus satu deklarasi, ditemukan ${hmHelperCount}`);
}

if (failures.length) {
  console.error("Static checks gagal:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(
    `Static checks lulus: ${htmlFiles.length} HTML, ${jsFiles.length} JS, ` +
    `${inlineScriptCount} inline scripts, ${localReferenceCount} referensi lokal.`,
  );
}
