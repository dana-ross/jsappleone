function CPU6502(emulator) {

	this.A = 0; this.X =0; this.Y = 0; this.S = 32 /* bit 5 set */; this.SP = 0; this.PC = 0;
	this.opcode = 0; this.opcode_name = ''; this.opcode_cycle = 0; this.addr_mode = '';
	this.operand = 0; this.instruction_addr = 0;

	this.reset = function() {
		this.A = this.X = this.Y = 0;
		this.S = 32; /* bit 5 set */
		this.SP = 0;
		this.PC = 0xFFFC;
		console.log("CPU initialized");
		cpu_initialized = true;
		var reset_vector = emulator.read_word(this.PC);
		console.log("Read reset vector " + reset_vector + " from location " + this.PC);
		this.PC = reset_vector;
	};

	this.set_nz = function(result) {

		// 128 N Negative
		// 64  V Overflow
		// 32  – ignored
		// 16  B Break
		// 8   D Decimal
		// 4   I Interrupt (IRQ disable)
		// 2   Z Zero
		// 1   C Carry

		// Zero flag
		if(result === 0) {
			this.S |= 2;
		}
		else {
			this.S &= ~2;
		}

		// Negative flag
		if(result & 128) {
			this.S |= 128;
		}
		else {
			this.S &= ~128;
		}

	};

	this.calculate_branch = function(operand) {
		if(operand & 128) {
			console.log('Branching backward ' + (~operand & 127) + ' bytes');
			this.PC -= ((~operand & 127) + 1);
		}
		else {
			console.log('Branching ahead ' + (operand & 127) + ' bytes');
			this.PC += (operand & 127);
		}
	};

	this.tick = function() {

		function format_operand(operand, addr_mode) {
			switch(addr_mode) {
				case 'implied':
					return '';
				case 'immediate':
					return '#$' + operand.toString(16);
				case 'absolute':
				case 'zeropage':
					return '$' + operand.toString(16);
				case 'absolute,x':
				case 'zeropage,x':
					return '$' + operand.toString(16) + ',X';
				case 'absolute,y':
				case 'zeropage,y':
					return '$' + operand.toString(16) + ',Y';
				case 'relative':
					if(operand & 128) {
						return '*-' + (~operand & 127).toString(10);
					}
					else {
						return '*+' + (operand & 127).toString(10);
					}
					break;
				case 'indirect':
					return '(' + operand.toString(16) + ')';
				case 'indexedindirect':
					return '(' + operand.toString(16) + ',X)';
				case 'indirectindexed':
					return '(' + operand.toString(16) + '),Y';
				default:
					throw new Error('Cannot format invalid address mode ' + addr_mode);
			}
		}

		if(this.opcode_cycle === 0) {
			this.instruction_addr = this.PC;
			this.opcode = emulator.read_byte(this.instruction_addr);
			this.addr_mode = 'immediate';
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
				if(this.opcode_cycle === 1) {
					this.Y -= 1;
					this.set_nz(this.Y);
					opcode_done = true;
				}
				break;
			case 0xa8:
				this.opcode_name = 'TAY';
				this.addr_mode = 'implied';
				break;
			case 0xc8:
				this.opcode_name = 'INY';
				this.addr_mode = 'implied';
				if(this.opcode_cycle === 1) {
					this.Y += 1;
					this.set_nz(this.Y);
					opcode_done = true;
				}
				break;
			case 0xe8:
				this.opcode_name = 'INX';
				this.addr_mode = 'implied';
				if(this.opcode_cycle === 1) {
					this.X += 1;
					this.set_nz(this.X);
					opcode_done = true;
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
				if(this.opcode_cycle === 1) {
					this.X -= 1;
					this.set_nz(this.X);
					opcode_done = true;
				}
				break;
			case 0xea:
				this.opcode_name = 'NOP';
				this.addr_mode = 'implied';
				break;
			// Conditional branches
			case 0x10:
				this.opcode_name = 'BPL';
				this.addr_mode = 'relative';
				if(this.opcode_cycle === 1) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					console.log((this.S & 128).toString(2));
					if(this.S & 128) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
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
				if(this.opcode_cycle === 1) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if(this.S & 2) {
						this.calculate_branch(this.operand);
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
								if(this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 1:
								this.addr_mode = 'zeropage';
								break;
							case 3:
								this.addr_mode = 'absolute';
								if(this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC);
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
											emulator.write_byte(this.operand, this.Y);
											opcode_done = true;
										}
										break;
								}
								break;
							case 5:
								this.opcode_name = 'LDY';
								switch(this.addr_mode) {
									case 'immediate':
										if(this.opcode_cycle === 1) {
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
								if(this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 3:
								this.addr_mode = 'absolute';
								if(this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC);
									this.PC += 2;
								}
								break;
							case 4:
								this.addr_mode = 'zeropage,y';
								break;
							case 5:
								this.addr_mode = 'zeropage,x';
								break;
							case 6:
								this.addr_mode = 'absolute,y';
								if(this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC + this.Y);
									this.PC += 2;
								}
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
											emulator.write_byte(this.operand, this.A);
											opcode_done = true;
										}
										break;
									case 'absolute,y':
										if(this.opcode_cycle === 5) {
											emulator.write_byte(this.operand, this.A);
											opcode_done = true;
										}
										break;
								}
								break;
							case 5:
								this.opcode_name = 'LDA';
								switch(this.addr_mode) {
									case 'immediate':
										if(this.opcode_cycle === 1) {
											this.A = this.operand;
											this.set_nz(this.A);
											opcode_done = true;
										}
										break;
									case 'absolute':
										if(this.opcode_cycle === 4) {
											this.A = emulator.read_byte(this.operand);
											console.log('read ' + this.A + ' from ' + this.operand.toString(16));
											this.set_nz(this.A);
											opcode_done = true;
										}
								}
								break;
							case 6:
								this.opcode_name = 'CMP';
								switch(this.addr_mode) {
									case 'immediate':
										if(this.opcode_cycle === 1) {
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

		// console.log('Processed opcode ' + this.opcode_name + ' address mode ' + this.addr_mode + ' cycle ' + this.opcode_cycle);
		console.log('$' + this.instruction_addr.toString(16).toUpperCase() + ' ' + this.opcode_name + ' ' + format_operand(this.operand, this.addr_mode) + '(' + this.opcode_cycle + ')');
		document.getElementById('status_z').innerHTML = (this.S & 2) ? '1' : '0';
		if(opcode_done) {
			this.opcode_cycle = 0;
		}
		else {
			this.opcode_cycle += 1;
		}
	};
}