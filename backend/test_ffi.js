const koffi = require('koffi');
const path = require('path');

const dllPath = path.resolve(__dirname, '../core/biyahe_core.dll');
const lib = koffi.load(dllPath);

const McRAPTOR = koffi.opaque('McRAPTOR');
const create_engine = lib.func('create_engine', koffi.pointer(McRAPTOR), []);
const destroy_engine = lib.func('destroy_engine', 'void', [koffi.pointer(McRAPTOR)]);
const query_route = lib.func('query_route', 'void', [koffi.pointer(McRAPTOR), 'string', 'string', 'int', 'char*', 'int']);
const get_stations = lib.func('get_stations', 'void', ['char*', 'int']);

const stationsBuffer = Buffer.alloc(8192);
get_stations(stationsBuffer, 8192);
const sResultStr = stationsBuffer.toString('utf-8');
const sNullIdx = sResultStr.indexOf('\0');
console.log(sNullIdx !== -1 ? sResultStr.slice(0, sNullIdx) : sResultStr);

const engine = create_engine();
const resultBuffer = Buffer.alloc(8192);
query_route(engine, "lrt1-baclaran", "lrt2-antipolo", 28800, resultBuffer, 8192);
const rResultStr = resultBuffer.toString('utf-8');
const rNullIdx = rResultStr.indexOf('\0');
console.log(rNullIdx !== -1 ? rResultStr.slice(0, rNullIdx) : rResultStr);
destroy_engine(engine);
