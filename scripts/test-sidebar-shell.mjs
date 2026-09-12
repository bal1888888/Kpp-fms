import fs from "node:fs";
const auth=fs.readFileSync("auth.js","utf8");
for(const needle of ["kpp-sidebar-shell","kpp-workspace-topbar","kppSidebarCollapsed","kpp-sidebar-mobile-open","Cari menu...","Sembunyikan Menu"]){if(!auth.includes(needle))throw new Error(`missing sidebar shell marker: ${needle}`);}
if(!auth.includes('body.kpp-sidebar-shell>.header'))throw new Error('legacy header is not suppressed by sidebar shell');
if(!auth.includes('window.innerWidth <= 900'))throw new Error('mobile drawer breakpoint missing');
console.log('sidebar shell regression checks passed');
