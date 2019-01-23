(function () {

	this.rom_loaded = false;
	this.cpu_initialized = false;
	this.cycle_count = 0;
	var self = this;

	this.generate_ram = function (bytes) {
		var ram = new Uint8Array(bytes);
		for (var i = 0; i < bytes; i++) {
			ram[i] = 0;
		}
		return ram;
	};

	this.load_unified_rom = function (url) {
		var req = new XMLHttpRequest();

		req.open("GET", url, true);
		req.responseType = "arraybuffer";
		req.onload = function (e) {
			romY_data = req.response;
			romY = new Uint8Array(romY_data);
			rom_loaded = true;
			console.log('ROM loaded');
		};
		req.send();
	};

	/**
	 *
	 * @param {string} low_nibble_url
	 * @param {string} high_nibble_url
	 */
	this.load_split_rom = function (low_nibble_url, high_nibble_url) {
		var req_low = new XMLHttpRequest();

		req_low.open("GET", low_nibble_url, true);
		req_low.responseType = "arraybuffer";
		req_low.onload = function (e) {
			var req_high = new XMLHttpRequest();

			req_high.open("GET", high_nibble_url, true);
			req_high.responseType = "arraybuffer";
			req_high.onload = function (e) {
				var rom_data_low = new Uint8Array(req_low.response),
					rom_data_high = new Uint8Array(req_high.response),
					rom_data = new Uint8Array(256);

				for(var i = 0; i < rom_data_low.length; i++) {
					// console.log(rom_data_low[i] | rom_data_high[i] << 4);
					rom_data[i] = rom_data_low[i] | rom_data_high[i] << 4;
				}
				romY = new Uint8Array(rom_data);
				rom_loaded = true;
				console.log('ROM loaded');
			};
			req_high.send();
		};
		req_low.send();
	};


	var ramX = generate_ram(65535);
    var romY, romY_data;
    load_unified_rom('6502_65C02_functional_tests/bin_files/6502_functional_test.bin');

	this.read_word = function (addr) {
		var hi = (read_byte(addr + 1) * 256);
		var lo = read_byte(addr);
		return hi + lo;
	};

	this.read_byte = function (addr) {

		addr = Math.floor(addr);

		if (addr > 65535 || addr < 0) {
			throw new Error('Invalid read address ' + addr);
		}

        if(addr < 0x400) {
            return ramX[addr];
        }
        else {
            return romY[addr];
        }
	};

	this.write_byte = function (addr, value) {

		addr = Math.floor(addr);

		if (addr > 65535 || addr < 0) {
			throw new Error('Invalid write address ' + addr);
        }
        
        if(addr < 0x400) {
            ramX[addr] = value;
        }
        else {
            romY[addr] = value;
        }

	};

	this.cpu = new CPU6502(this);

	this.symbol_table = function (addr) {
		var symbols = {};
		return symbols[addr];
	};

	this.tick = function () {
		this.cycle_count += 1;
		if (rom_loaded && terminal.charmap_loaded) {
			if (!cpu_initialized) {
				cpu.reset();
			} else {
				cpu.tick();
				terminal.tick();
			}
		} else {
			console.log('ROM not loaded');
		}

		var status_display = document.getElementById('status_display');
		if (status_display) {
			status_display.value = 'cycle: ' + cycle_count + "\n" + cpu.status() + pia.status();
		}

		setTimeout(tick, 250);
	};
	tick();

})();
