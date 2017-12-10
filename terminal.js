function terminal(emulator) {

	this.load_rom = function (url) {
		var self = this,
			req = new XMLHttpRequest();

		req.open("GET", url, true);
		req.responseType = "arraybuffer";
		req.onload = function (e) {
			self.charmap_data = req.response;
			self.charmap = new Uint8Array(self.charmap_data);
			self.charmap_loaded = true;
			console.log('Character ROM loaded');
			window.requestAnimationFrame(self.draw_screen);
		};
		req.send();
	};

	/**
	 * Load a character bitmap from the character ROM
	 * @param int character ASCII code
	 * @return Uint8Array
	 */
	this.char_bitmap = function (character) {
		var bitmap = new Uint8Array(8);
		for (var scanline = 0; scanline < 8; scanline++) {
			bitmap[scanline] = this.charmap[(character * 8) + scanline];
		}
		return bitmap;
	};

	/**
	 * Repaint the screen
	 */
	this.draw_screen = function () {
		var bitmap;
		emulator.screen.clear();
		for (var row = 0; row < 24; row++) {
			for (var col = 0; col < 40; col++) {
				bitmap = self.char_bitmap(self.shift_register[(row * 40) + col]);
				for (var bitmap_row = 0; bitmap_row < 8; bitmap_row++) {
					for (var bitmap_col = 0; bitmap_col < 8; bitmap_col++) {
						if (bitmap[bitmap_row] & (Math.pow(2, bitmap_col))) {
							emulator.screen.point(((col * 8) + bitmap_col), (row * 8) + bitmap_row);
						}
					}
				}
			}
		}
		window.requestAnimationFrame(self.draw_screen);
	};

	/**
	 * Insert a character at the current location in the shift register
	 */
	this.insert_char = function (character) {
		this.shift_register[this.insert_pos] = character;
		this.insert_pos += 1;
		if (this.insert_pos > (40 * 24)) {
			this.insert_pos = 0;
		}
	};

	this.newline = function () {
		this.insert_pos = (Math.floor(this.insert_pos / 40) * 40) + 40;
	};

	this.tick = function () {
		var key = (emulator.read_byte(0xd012) & 127);
		if (0 !== key) {
			// debugger;
			// console.log("D012 has " + key);
			if (13 !== key) {
				this.insert_char(key);
			}
			// emulator.write_byte(0xd010, 0);
			// emulator.write_byte(0xd011, 0);
			// emulator.write_byte(0xd012, 0);
			// emulator.write_byte(0xd013, 0);
		}
		// emulator.write_byte(0xd012, emulator.read_byte(0xd012) & 63);
	};

	this.shift_register = emulator.generate_ram(1024);
	this.charmap_loaded = false;
	this.load_rom('rom/charmap.rom');
	this.insert_pos = 0;
	var self = this;

}
