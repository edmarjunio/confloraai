const path=require('node:path');const base=require('../playwright.config');const root=path.resolve(__dirname,'..');
module.exports={...base,testDir:path.join(root,'test/browser'),webServer:{...base.webServer,cwd:root,timeout:10000}};
