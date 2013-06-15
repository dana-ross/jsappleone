function terminal(emulator) {
	var shift_register = emulator.generate_ram(1024);

	this.load_rom = function(url) {
		var self = this, req = new XMLHttpRequest();

		req.open("GET", url, true);
		req.responseType = "arraybuffer";
		req.onload = function(e) {
			self.charmap_data = req.response;
			self.charmap = new Uint8Array(self.charmap_data);
			self.charmap_loaded = true;
			console.log('Character ROM loaded');

			self.char_bitmap(1);  // "A"
		};
		req.send();
	};

	this.char_bitmap = function(character) {
		var bitmap = new Uint8Array(8 /* rows */ * 5 /* bits */);
		for(var row = 0; row < 8; row += 1) {
			var address = ((row & 7) + (character << 3) & 0xff);
			address = address & 239; // ignore bit 5
			address = address ^ 32; // invert bit 6
			console.log('row ' + (row & 7));
			console.log('address ' + address + ' ' + address.toString(16));
			var data = this.charmap[address];
			console.log('data ' + data.toString(2));

		}
		debugger;
	};

	var charmap_loaded = false;
	var charmap, charmap_data; this.load_rom('rom/charmap.rom');

}