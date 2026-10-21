import {defineConfig} from 'vite';
export default defineConfig({server:{allowedHosts:['terminal.local'],proxy:{'/api':{target:'https://spinoutclub.cc',changeOrigin:true}}}});
