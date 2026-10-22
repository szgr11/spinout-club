import {defineConfig} from 'vite';
export default defineConfig({build:{emptyOutDir:true},server:{allowedHosts:['terminal.local'],proxy:{'/api':{target:'https://spinoutclub.cc',changeOrigin:true}}}});
