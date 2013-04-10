(function() {

	var rom_loaded = false;
	var cpu_initialized = false;

	function generate_ram(bytes) {
		var ram = new Uint8Array(bytes);
		for(var i = 0; i < bytes; i++) {
			ram[i] = 0;
		}
		return ram;
	}

	function load_rom(url) {
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
	}

	var ramX = generate_ram(4096);
	var ramW = generate_ram(4096);
	var romY, romY_data; load_rom('rom/monitor.rom');

	function read_word(addr) {
		var hi = (read_byte(addr+1) * 256);
		var lo = read_byte(addr);
		return hi + lo;
	}

	function read_byte(addr) {

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
				return 0;
			case 14:
				// Banked RAM here to run BASIC
				return ramW[bank_addr];
			case 15:
				bank_addr = bank_addr % 256;
				return romY[bank_addr];
		}

	}

	function write_byte(addr, value) {

		addr = Math.floor(addr);

		if(addr > 65535 || addr < 0) {
			throw new Error('Invalid write address ' + addr);
		}

		var bank = Math.floor(addr / 4096);
		var bank_addr = addr % 4096;
		console.log('Writing value ' + value + ' to addr ' + bank_addr + ' in bank ' + bank);

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
				return 0;
			case 14:
				// Banked RAM here to run BASIC
				ramW[bank_addr] = value;
				return;
			case 15:
				throw new Error('Writing to ROM at address ' + addr);
		}

	}

	this.cpu = {

		A: 0, X: 0, Y: 0, S: 32 /* bit 5 set */, SP: 0, PC: 0,
		opcode: 0, opcode_name: '', opcode_cycle: 0, addr_mode: '',
		operand: 0,

		reset: function() {
			this.A = this.X = this.Y = 0;
			this.S = 32; /* bit 5 set */
			this.SP = 0;
			this.PC = 0xFFFC;
			console.log("CPU initialized");
			cpu_initialized = true;
			var reset_vector = read_word(this.PC);
			console.log("Read reset vector " + reset_vector + " from location " + this.PC);
			this.PC = reset_vector;
		},

		set_nz: function(result) {
			if(result === 0) {
				this.S &= 2;
			}
			else {
				this.S ^= 2;
			}
		},

		tick: function() {

			if(this.opcode_cycle === 0) {
				this.opcode = read_byte(this.PC);
				this.addr_mode = 'immediate';
				console.log("Read opcode " + this.opcode.toString(16) + ' (' + this.opcode.toString(2) + ") from location " + this.PC);
				this.PC += 1;
				this.opcode_cycle += 1;
				return;
			}

			// Decode the opcode
			// see http://www.llx.com/~nparker/a2/opcodes.html
			var aaa = (this.opcode & 224) >> 5,
				bbb = (this.opcode & 28) >> 2,
				cc = this.opcode & 3;

			if(cc == 3) {
				throw new Error('Invalid 11 opcode ' + this.opcode.toString(2));
			}
			var opcode_done = false;

			switch(this.opcode) {
				// Single-byte instructions
				case 0x08:
					this.opcode_name = 'PHP';
					this.addr_mode = 'implied';
					break;
				case 0x28:
					this.opcode_name = 'PLP';
					this.addr_mode = 'implied';
					break;
				case 0x48:
					this.opcode_name = 'PHA';
					this.addr_mode = 'implied';
					break;
				case 0x68:
					this.opcode_name = 'PLA';
					this.addr_mode = 'implied';
					break;
				case 0x88:
					this.opcode_name = 'DEY';
					this.addr_mode = 'implied';
					if(this.opcode_cycle == 1) {
						this.Y -= 1;
						this.set_nz(this.Y);
						this.opcode_done = true;
					}					
					break;
				case 0xa8:
					this.opcode_name = 'TAY';
					this.addr_mode = 'implied';
					break;
				case 0xc8:
					this.opcode_name = 'INY';
					this.addr_mode = 'implied';
					if(this.opcode_cycle == 1) {
						this.Y += 1;
						this.set_nz(this.Y);
						this.opcode_done = true;
					}
					break;
				case 0xe8:
					this.opcode_name = 'INX';
					this.addr_mode = 'implied';
					if(this.opcode_cycle == 1) {
						this.X += 1;
						this.set_nz(this.X);
						this.opcode_done = true;
					}					
					break;
				case 0x18:
					this.opcode_name = 'CLC';
					this.addr_mode = 'implied';
					break;
				case 0x38:
					this.opcode_name = 'SEC';
					this.addr_mode = 'implied';
					break;
				case 0x58:
					this.opcode_name = 'CLI';
					this.addr_mode = 'implied';
					// Clear bit 2 of status
					this.S &= 251;
					opcode_done = true;
					break;
				case 0x78:
					this.opcode_name = 'SEI';
					this.addr_mode = 'implied';
					break;
				case 0x98:
					this.opcode_name = 'TYA';
					this.addr_mode = 'implied';
					break;
				case 0xb8:
					this.opcode_name = 'CLV';
					this.addr_mode = 'implied';
					break;
				case 0xd8:
					this.opcode_name = 'CLD';
					this.addr_mode = 'implied';
					// Clear bit 5 of status
					this.S &= 247;
					opcode_done = true;
					break;
				case 0xf8:
					this.opcode_name = 'SED';
					this.addr_mode = 'implied';
					break;
				case 0x8a:
					this.opcode_name = 'TXA';
					this.addr_mode = 'implied';
					break;
				case 0x9a:
					this.opcode_name = 'TXS';
					this.addr_mode = 'implied';
					break;
				case 0xaa:
					this.opcode_name = 'TAX';
					this.addr_mode = 'implied';
					break;
				case 0xba:
					this.opcode_name = 'TSX';
					this.addr_mode = 'implied';
					break;
				case 0xca:
					this.opcode_name = 'DEX';
					this.addr_mode = 'implied';
					if(this.opcode_cycle == 1) {
						this.X -= 1;
						this.set_nz(this.X);
						this.opcode_done = true;
					}
					break;
				case 0xea:
					this.opcode_name = 'NOP';
					this.addr_mode = 'implied';
					break;
				// Conditional branches
				case 0x10:
					this.opcode_name = 'BPL';
					this.addr_mode = 'implied';
					break;
				case 0x30:
					this.opcode_name = 'BMI';
					this.addr_mode = 'implied';
					break;
				case 0x50:
					this.opcode_name = 'BVC';
					this.addr_mode = 'implied';
					break;
				case 0x70:
					this.opcode_name = 'BVS';
					this.addr_mode = 'implied';
					break;
				case 0x90:
					this.opcode_name = 'BCC';
					this.addr_mode = 'implied';
					break;
				case 0xb0:
					this.opcode_name = 'BCS';
					this.addr_mode = 'implied';
					break;
				case 0xd0:
					this.opcode_name = 'BNE';
					this.addr_mode = 'implied';
					break;
				case 0xf0:
					this.opcode_name = 'BEQ';
					this.addr_mode = 'implied';
					if(this.opcode_cycle == 1) {
						this.operand = read_byte(this.PC);
						this.PC += 1;
						if(this.S & 2) {
							console.log('Branching ahead ' + this.operand + ' bytes');
							this.PC += this.operand;
						}
						opcode_done = true;
					}
					break;
				default:
					switch(cc) {
						case 0:
							switch(bbb) {
								case 0:
									this.addr_mode = 'immediate';
									if(this.opcode_cycle == 1) {
										this.operand = read_byte(this.PC);
										this.PC += 1;
									}
									break;
								case 1:
									this.addr_mode = 'zeropage';
									break;
								case 3:
									this.addr_mode = 'absolute';
									if(this.opcode_cycle == 1) {
										this.operand = read_word(this.PC);
										this.PC += 2;
									}				
									break;
								case 5:
									this.addr_mode = 'zeropage,x';
									break;
								case 7:
									this.addr_mode = 'absolute,x';
									break;
								default:
									throw new Error('Invalid addressing mode ' + bbb.toString(2) + ' for opcode ' + opcode.toString(2) + ' at address ' + this.PC);
							}
							switch(aaa) {
								case 0:
									throw new Error('Invalid opcode ' + opcode.toString(2) + ' at address ' + this.PC);
								case 1:
									this.opcode_name = 'BIT';
									break;
								case 2:
									this.opcode_name = 'JMP';
									break;
								case 3:
									this.opcode_name = 'JMP';
									break;
								case 4:
									this.opcode_name = 'STY';
									switch(this.addr_mode) {
										case 'absolute':
											if(this.opcode_cycle == 3) {
												write_byte(this.operand, this.Y);
												opcode_done = true;
											}
											break;
									}
									break;
								case 5:
									this.opcode_name = 'LDY';
									switch(this.addr_mode) {
										case 'immediate':
											if(this.opcode_cycle == 1) {
												this.Y = this.operand;
												this.set_nz(this.Y);
												opcode_done = true;
											}
											break;
									}
									break;
								case 6:
									this.opcode_name = 'CPY';
									break;
								case 7:
									this.opcode_name = 'CPX';
									break;
							}
							break;
						case 1:
							switch(bbb) {
								case 0:
									this.addr_mode = 'zeropage,x';
									break;
								case 1:
									this.addr_mode = 'zeropage';
									break;
								case 2:
									this.addr_mode = 'immediate';
									if(this.opcode_cycle == 1) {
										this.operand = read_byte(this.PC);
										this.PC += 1;
									}
									break;
								case 3:
									this.addr_mode = 'absolute';
									if(this.opcode_cycle == 1) {
										this.operand = read_word(this.PC);
										this.PC += 2;
									}
									break;
								case 4:
									this.addr_mode = 'zeropage,yindex';
									break;
								case 5:
									this.addr_mode = 'zeropage,x';
									break;
								case 6:
									this.addr_mode = 'absolute,y';
									break;
								case 7:
									this.addr_mode = 'absolute,x';
									break;
								default:
									throw new Error('Invalid addressing mode ' + bbb.toString(2) + ' for opcode ' + opcode.toString(2) + ' at address ' + this.PC);
							}
							switch(aaa) {
								case 0:
									this.opcode_name = 'ORA';
									break;
								case 1:
									this.opcode_name = 'AND';
									break;
								case 2:
									this.opcode_name = 'EOR';
									break;
								case 3:
									this.opcode_name = 'ADC';
									break;
								case 4:
									this.opcode_name = 'STA';
									switch(this.addr_mode) {
										case 'absolute':
											if(this.opcode_cycle == 3) {
												write_byte(this.operand, this.A);
												opcode_done = true;
											}
											break;
									}									
									break;
								case 5:
									this.opcode_name = 'LDA';
									switch(this.addr_mode) {
										case 'immediate':
											if(this.opcode_cycle == 1) {
												this.A = this.operand;
												this.set_nz(this.A);
												opcode_done = true;
											}
											break;
									}
									break;
								case 6:
									this.opcode_name = 'CMP';
									switch(this.addr_mode) {
										case 'immediate':
											if(this.opcode_cycle == 1) {
												console.log('Comparing ' + this.A + ' to ' + this.operand);
												this.set_nz(this.A - this.operand);
												opcode_done = true;
											}
									}
									break;
								case 7:
									this.opcode_name = 'SBC';
									break;
								default:
							}
							break;
						case 2:
						case 3:
							throw new Error('Invalid opcode ' + this.opcode.toString(2) + ' at address ' + this.PC);
					}
				
			}
			
			console.log('Processed opcode ' + this.opcode_name + ' address mode ' + this.addr_mode + ' cycle ' + this.opcode_cycle);
			document.getElementById('status_z').innerHTML = (this.S & 2) ? '1' : '0';
			if(opcode_done) {
				this.opcode_cycle = 0;
			}
			else {
				this.opcode_cycle += 1;
			}
		}

	};

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

	setInterval(this.tick, 200);

})();