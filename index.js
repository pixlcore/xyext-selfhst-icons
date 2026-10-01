// selfhst icon pack extension
// Copyright (c) 2026 PixlCore LLC
// MIT License

const fs = require('fs');
const Path = require('path');
const Tools = require('pixl-tools');
const pkg = require('./package.json');

module.exports = {

	init() {
		// load extension
		var icon_pkg_path = '';
		var icon_pkg = null;
		try {
			icon_pkg_path = require.resolve('@iconify-icons/selfhst/package.json');
			icon_pkg = require(icon_pkg_path);
		}
		catch (err) {
			this.logDebug(1, "Failed to load selfhst package: " + err);
			return;
		}
		
		this.iconBasePath = Path.dirname(icon_pkg_path);
		this.icons = {};
		
		Object.keys(icon_pkg.exports).forEach( key => {
			if (!key.match(/^\.\/(\S+)$/)) return;
			var icon_id = RegExp.$1;
			var info = icon_pkg.exports[key];
			if (!icon_id.match(/^[\w\-]+$/)) return;
			
			// use light variants only, so the svg works as a mask image
			if (!icon_id.match(/\-light$/)) return;
			icon_id = icon_id.replace(/\-light$/, '');
			
			this.icons[icon_id] = info.default;
		} );
		
		this.logDebug(5, "selfhst-icon pack starting up", { version: pkg.version, icons: Tools.numKeys(this.icons) });
		
		// add icon names to client payload
		this.client.iconNames = Object.keys(this.icons);
	},
	
	handleRequest(args, callback) {
		// serve up svg for specified icon
		// e.g. /api/app/ext/pixlcore-xyext-selfhst-icons/${name}.svg
		var self = this;
		
		if (!args.request.url.match(/\/([\w\-]+)\.svg$/)) {
			return callback( "400 Bad Request", {}, '400 Bad Request');
		}
		var icon_name = RegExp.$1;
		var icon_sub_path = this.icons[icon_name];
		
		if (!icon_sub_path) {
			return callback( "404 Not Found", {}, '404 Not Found: ' + icon_name);
		}
		
		var icon_path = Path.resolve( this.iconBasePath, icon_sub_path );
		
		fs.readFile(icon_path, 'utf8', function(err, icon_raw) {
			if (err) {
				return callback("500 Internal Server Error", {}, "Failed to load icon file: " + icon_data_file + ": " + err);
			}
			
			// extract json out of javascript file (messy)
			if (!icon_raw.match(/^[^\{]*(\{[\s\S]*?\})[^\{]*$/)) {
				return callback("500 Internal Server Error", {}, "Malformed icon file: " + icon_data_file);
			}
			
			var json_raw = RegExp.$1;
			var icon_data = null;
			
			try { 
				icon_data = JSON.parse(json_raw); 
				if (!icon_data.width) throw "Missing width";
				if (!icon_data.height) throw "Missing height";
				if (!icon_data.body) throw "Missing body";
			}
			catch (err) {
				return callback("500 Internal Server Error", {}, "Malformed icon data: " + icon_data_file + ": " + err);
			}
			
			var svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon_data.width} ${icon_data.height}">${icon_data.body}</svg>`;
			var ttl = self.config.ttl || 31536000; // default 1 year
			
			callback( '200 OK', { 'Content-Type': "image/svg+xml", 'Cache-Control': "public, max-age=" + ttl }, svg );
		}); // fs.readFile
	},
	
	client: {
		iconNames: [],
		
		init: function() {
			// this code runs client-side
			Debug.trace('ext', "Injecting selfhst-icons: " + this.iconNames.length + " icons");
			
			var lines = [`.mdi[class*="mdi-selfhst-"]:before { content: ""; width: 1em; height: 1em; vertical-align: -0.175em; background-color: currentColor; }`];
			this.iconNames.forEach( function(name) {
				lines.push( `.mdi.mdi-selfhst-${name}:before { mask: url("/api/app/ext/pixlcore-xyext-selfhst-icons/${name}.svg") no-repeat center / contain; }` );
			} );
			
			const style = document.createElement('style');
			style.textContent = lines.join("\n");
			document.head.appendChild(style);
			
			// add our icons to the master list and re-sort
			iconFontNames = iconFontNames.concat( this.iconNames.map( name => 'selfhst-' + name ) );
			iconFontNames.sort();
		}
	}

};

