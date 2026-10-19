import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const master=readFileSync(new URL("../master-storage.html",import.meta.url),"utf8");
const stock=readFileSync(new URL("../stock.html",import.meta.url),"utf8");

test("import parsers are not downloaded as eager scripts",()=>{
  assert.doesNotMatch(master,/<script[^>]+src="[^"]*(?:xlsx\.full\.min|mammoth\.browser\.min)\.js/);
  assert.match(master,/if\(name\.endsWith\("\.docx"\)\)\{\s*await ensureTeraImportVendor\("word"\)/);
  assert.match(master,/\}else\{\s*await ensureTeraImportVendor\("excel"\)/);
  assert.match(master,/TERA_IMPORT_VENDOR_LOADING\.delete\(kind\)/);
});
test("Stock auto-refresh stays active only when foreground and no draft",()=>{
  assert.match(stock,/function stockAutoRefresh\(\)\{\s*[\s\S]*?document\.visibilityState==="hidden"\)return/);
  assert.match(stock,/STOCK_AUTO_REFRESH_BUSY \|\| STOCK_SAVE_LOCK \|\| STOCK_CLOSING_INPUT_DIRTY/);
  assert.match(stock,/Promise\.resolve\(loadStock\(\)\)/);
});
