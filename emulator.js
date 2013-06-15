(function() {

	this.rom_loaded = false;
	this.cpu_initialized = false;

	this.generate_ram = function(bytes) {
		var ram = new Uint8Array(bytes);
		for(var i = 0; i < bytes; i++) {
			ram[i] = 0;
		}
		return ram;
	};

	this.load_rom = function(url) {
		var self = this, req = new XMLHttpRequest();

		req.open("GET", url, true);
		req.responseType = "arraybuffer";
		req.onload = function(e) {
			romY_data = req.response;
			romY = new Uint8Array(romY_data);
			rom_loaded = true;
			console.log('ROM loaded');
		};
		req.send();
	};

	var ramX = generate_ram(4096);
	var ramW = generate_ram(4096);
	var pia = new PIA6821(this);
	var romY, romY_data; load_rom('rom/monitor.rom');

	this.read_word = function(addr) {
		var hi = (read_byte(addr+1) * 256);
		var lo = read_byte(addr);
		return hi + lo;
	};

	this.read_byte = function(addr) {

		addr = Math.floor(addr);

		if(addr > 65535 || addr < 0) {
			throw new Error('Invalid read address ' + addr);
		}

		var bank = Math.floor(addr / 4096);
		var bank_addr = addr % 4096;
		// console.log('Reading addr ' + bank_addr + ' from bank ' + bank);

		// TODO support memory remapping to support Woz's patching area
		// see http://www.sbprojects.com/projects/apple1/a1block.php
		switch(bank) {
			case 0:
				return ramX[bank_addr];
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
			case 6:
			case 7:
			case 8:
			case 9:
				return 0;
			case 10:
			case 11:
			case 12:
				// Peripheral slot. Not implemented.
				return 0;
			case 13:
				// PIA
				return pia.read(bank_addr & 3);
			case 14:
				// Banked RAM here to run BASIC
				return ramW[bank_addr];
			case 15:
				bank_addr = bank_addr % 256;
				return romY[bank_addr];
		}

	};

	this.write_byte = function(addr, value) {

		addr = Math.floor(addr);

		if(addr > 65535 || addr < 0) {
			throw new Error('Invalid write address ' + addr);
		}

		var bank = Math.floor(addr / 4096);
		var bank_addr = addr % 4096;
		console.log('Writing value ' + value + '($' + value.toString(16) + ') to addr ' + bank_addr + '($' + bank_addr.toString(16) + ') in bank ' + bank);

		// TODO support memory remapping to support Woz's patching area
		// see http://www.sbprojects.com/projects/apple1/a1block.php
		switch(bank) {
			case 0:
				ramX[bank_addr] = value;
				return;
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
			case 6:
			case 7:
			case 8:
			case 9:
				return 0;
			case 10:
			case 11:
			case 12:
				// Peripheral slot. Not implemented.
				return 0;
			case 13:
				// PIA
				return pia.write(bank_addr & 3, value);
			case 14:
				// Banked RAM here to run BASIC
				ramW[bank_addr] = value;
				return;
			case 15:
				throw new Error('Writing to ROM at address ' + addr);
		}

	};

	this.cpu = new CPU6502(this);

	var keyboard = (function() {

		/**
		 * Convert a lowercase keyCode to uppercase
		 */
		function uppercase(keyCode) {
			// 97 = a, 65 = A
			if(keyCode >= 97 && keyCode <= 122) {
				return keyCode - 32;
			}
			// Fall through. Return what was passed.
			return keyCode;
		}

		document.onkeypress = function(e) {
			var key = uppercase(e.keyCode ? e.keyCode : e.charCode);
			console.log("ASCII code " + key);
			write_byte(0xd011, 128);
			write_byte(0xd010, (128 | (key & 127)));
		};

	})();

	this.tick = function() {
		if(rom_loaded) {
			if(!cpu_initialized) {
				cpu.reset();
			}
			else {
				cpu.tick();
			}
		}
		else {
			console.log('ROM not loaded');
		}
	};

	setInterval(tick, 100);

})();