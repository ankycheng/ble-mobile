// Change this to your repository name
var GHPATH = '/ble-mobile';
 
// Choose a different app prefix name
var APP_PREFIX = 'ble_mobile_';
 
// The version of the cache. Every time you change any of the files
// you need to change this version (version_01, version_02…). 
// If you don't change the version, the service worker will give your
// users the old files!
var VERSION = 'version_00';
 
var URLS = [    
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/ble-mobile/static/manifest.json`,
  `${GHPATH}/offline.html`,
  `${GHPATH}/p5.js`,
  `${GHPATH}/p5.ble.js`,
  `${GHPATH}/sketch2.js`,
  `${GHPATH}/style.css`,
]