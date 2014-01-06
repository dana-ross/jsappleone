(function() {

	this.rom_loaded = false;
	this.cpu_initialized = false;
	this.cycle_count = 0;
	var self = this;

	this.generate_ram = function(bytes) {
		var ram = new Uint8Array(bytes);
		for(var i = 0; i < bytes; i++) {
			ram[i] = 0;
		}
		return ram;
	};

	this.load_rom = function(url) {
		var req = new XMLHttpRequest();

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

	this.screen = new screen(this);
	this.terminal = new terminal(this);
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
			write_byte(0xd011, 255);
			write_byte(0xd010, (128 | (key & 127)));
			// write_byte(0xd010, key);
			if(key == 13) {
				self.terminal.newline();
			}

			setTimeout(function() {
				write_byte(0xd010, 0);
				write_byte(0xd011, 207);
			}, 1000);
			// else {
				// self.terminal.insert_char(key);
			// }
			// pia.trigger_ca1();
		};

	})();


	this.symbol_table = function(addr) {
		var symbols = {
			0x24: 'XAML',
			0x25: 'XAMH',
			0x26: 'STL',
			0x27: 'STH',
			0x28: 'L',
			0x29: 'H',
			0x2A: 'YSAV',
			0x2B: 'MODE',

			0x0200: 'IN',
			0xd010: 'KBD',
			0xd011: 'KBDCR',
			0xd012: 'DSP',
			0xd013: 'DSPCR',

			0xff00: 'RESET',
			0xff0f: 'NOTCR',
			0xff1a: 'ESCAPE',
			0xff1f: 'GETLINE',
			0xff26: 'BACKSPACE',
			0xff29: 'NEXTCHAR',
			0xff40: 'SETSTOR',
			0xff41: 'SETMODE',
			0xff43: 'BLSKIP',
			0xff44: 'NEXTITEM',
			0xff5f: 'NEXTHEX',
			0xff6e: 'DIG',
			0xff74: 'HEXSHIFT',
			0xff7f: 'NOTHEX',
			0xff91: 'TONEXTITEM',
			0xff94: 'RUN',
			0xff97: 'NOTSTOR',
			0xff9b: 'SETADR',
			0xffa4: 'NXTPRNT',
			0xffba: 'PRDATA',
			0Xffc4: 'XAMNEXT',
			0xffd6: 'MOD8CHK',
			0xffdc: 'PRBYTE',
			0xffe5: 'PRHEX',
			0xffef: 'ECHO'
		};

		return symbols[addr];

	};

	this.tick = function() {
		this.cycle_count += 1;
		if(rom_loaded && terminal.charmap_loaded) {
			if(!cpu_initialized) {
				cpu.reset();
			}
			else {
				cpu.tick();
				terminal.tick();
			}
		}
		else {
			console.log('ROM not loaded');
		}

		var status_display = document.getElementById('status_display');
		if(status_display) {
			status_display.value = 'cycle: ' + cycle_count + "\n" + cpu.status() + pia.status();
		}

		setTimeout(tick, 1);
	};
	tick();

})();