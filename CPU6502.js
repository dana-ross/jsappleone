function CPU6502(emulator) {

	this.A = 0;
	this.X = 0;
	this.Y = 0;
	this.S = 32 /* bit 5 set */ ;
	this.SP = 0;
	this.PC = 0;
	this.opcode = 0;
	this.opcode_name = '';
	this.opcode_cycle = 0;
	this.addr_mode = '';
	this.operand = 0;
	this.instruction_addr = 0;
	this.do_irq = false; // true if IRQ processing needs to happen after current instruction
	this.do_nmi = false;

	this.reset = function () {
		this.A = this.X = this.Y = 0;
		this.S = 32; /* bit 5 set */
		this.SP = 0;
		this.PC = 0xFFFC;
		console.log("CPU initialized");
		cpu_initialized = true;
		var reset_vector = emulator.read_word(this.PC);
		console.log("Read reset vector " + reset_vector + " from location " + this.PC);
		this.PC = reset_vector;
	}

	/**
	 * Set/reset the zero flag
	 */
	this.setz = function (result) {
		// Zero flag
		if (result === 0) {
			this.S |= 2;
		} else {
			this.S &= ~2;
		}
	};

	/**
	 * Set/Reset the overflow flag
	 */
	this.setv = function (result) {
		if (result === 0) {
			this.S |= 64;
		} else {
			this.S &= ~64;
		}
	};

	/**
	 * Set/reset the negative flag
	 */
	this.setn = function (result) {
		// Negative flag
		if (result & 128) {
			this.S |= 128;
		} else {
			this.S &= ~128;
		}
	};

	/**
	 * Set the negative & zero flags appropriately
	 */
	this.set_nz = function (result) {

		// 128 N Negative
		// 64  V Overflow
		// 32  – ignored
		// 16  B Break
		// 8   D Decimal
		// 4   I Interrupt (IRQ disable)
		// 2   Z Zero
		// 1   C Carry

		this.setz(result);
		this.setn(result);

	};

	/**
	 * Set/reset the carry flag
	 */
	this.setc = function (result) {
		this.S = (this.S & 254) + (result >= 0);
	}

	this.calculate_branch = function (operand) {
		if (operand & 128) {
			console.log('Branching backward ' + (~operand & 127) + ' bytes');
			this.PC -= ((~operand & 127) + 1);
		} else {
			console.log('Branching ahead ' + (operand & 127) + ' bytes');
			this.PC += (operand & 127);
		}
	};

	/**
	 * Implements the BIT opcode
	 */
	this.do_bit = function (operand) {
		this.setz(this.A & operand);
		this.setv(operand & 64);
		this.setn(operand & 128);
	};

	/**
	 * Push a byte onto the stack
	 */
	this.push_byte = function (value) {
		emulator.write_byte(this.SP + 0x100, value);
		this.SP = (this.SP + 1) & 0xff;
	};

	/**
	 * Push a word onto the stack
	 */
	this.push_word = function (value) {
		this.push_byte(value & 0x00ff);
		this.push_byte((value & 0xff00) >> 8);
	};

	/**
	 * Pop a value off the stack
	 */
	this.pop_byte = function () {
		this.SP = (this.SP - 1) & 0xff;
		return emulator.read_byte(this.SP + 0x100);
	};

	/**
	 * Pop a word off the stack
	 */
	this.pop_word = function (value) {
		var word = this.pop_byte() << 8;
		word += this.pop_byte();
		return word;
	};

	this.irq = function () {
		if (!(this.S & 4)) {
			this.do_irq = true;
		}
	};

	this.nmi = function () {
		this.do_nmi = true;
	};

	this.tick = function () {

		function format_operand(operand, addr_mode) {
			var operand_symbol = emulator.symbol_table(operand);
			switch (addr_mode) {
				case 'implied':
				case 'accumulator':
					return '';
				case 'immediate':
					return '#$' + operand.toString(16);
				case 'absolute':
				case 'zeropage':
					return (undefined !== operand_symbol) ? operand_symbol : ('$' + operand.toString(16));
				case 'absolute,x':
				case 'zeropage,x':
					return (undefined !== operand_symbol) ? operand_symbol : ('$' + operand.toString(16)) + ',X';
				case 'absolute,y':
				case 'zeropage,y':
					return (undefined !== operand_symbol) ? operand_symbol : ('$' + operand.toString(16)) + ',Y';
				case 'relative':
					if (operand & 128) {
						return '*-' + (~operand & 127).toString(10);
					} else {
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

		if (this.opcode_cycle === 0) {
			if (this.do_irq) {
				this.push_word(this.PC);
				this.push_byte(this.S);
				this.S &= 251; // disable interrupts
				this.PC = emulator.read_word(0xfffe);
			}

			if (this.do_nmi) {
				this.push_word(this.PC);
				this.push_byte(this.S);
				this.S &= 251; // disable interrupts
				this.PC = emulator.read_word(0xffea);
			}

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
		console.log(`aaa: ${aaa} bbb: ${bbb} cc: ${cc}`)
		console.log(this.addressingModeName(aaa, bbb, cc))
		if (cc == 3) {
			throw new Error('Invalid 11 opcode ' + this.opcode.toString(2));
		}
		var opcode_done = false;

		switch (this.opcode) {
			// Single-byte instructions
			case 0x08:
				this.opcode_name = 'PHP';
				this.addr_mode = 'implied';
				throw "Unimplemented opcode " + this.opcode_name;
				break;
			case 0x28:
				this.opcode_name = 'PLP';
				this.addr_mode = 'implied';
				throw "Unimplemented opcode " + this.opcode_name;
				break;
			case 0x48:
				this.opcode_name = 'PHA';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 3) {
					this.SP = (this.SP - 1) && 0x00ff;
					emulator.write_byte(0x0100 + this.SP, this.A);
				}
				break;
			case 0x68:
				this.opcode_name = 'PLA';
				this.addr_mode = 'implied';
				throw "Unimplemented opcode " + this.opcode_name;
				break;
			case 0x88:
				this.opcode_name = 'DEY';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 1) {
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
				if (this.opcode_cycle === 1) {
					this.Y += 1;
					this.set_nz(this.Y);
					opcode_done = true;
				}
				break;
			case 0xe8:
				this.opcode_name = 'INX';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 1) {
					this.X += 1;
					this.set_nz(this.X);
					opcode_done = true;
				}
				break;
			case 0x18:
				this.opcode_name = 'CLC';
				this.addr_mode = 'implied';
				this.setc(-1)
				break;
			case 0x38:
				this.opcode_name = 'SEC';
				this.addr_mode = 'implied';
				this.setc(1)
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
				// Set bit 2 of status
				this.S |= 4;
				opcode_done = true;
				break;
			case 0x98:
				this.opcode_name = 'TYA';
				this.addr_mode = 'implied';
				throw "Unimplemented opcode " + this.opcode_name;
				break;
			case 0xb8:
				this.opcode_name = 'CLV';
				this.addr_mode = 'implied';
				throw "Unimplemented opcode " + this.opcode_name;
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
				throw "Unimplemented opcode " + this.opcode_name;
				break;
			case 0x8a:
				this.opcode_name = 'TXA';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.A = this.X;
					opcode_done = true;
				}
				break;
			case 0x9a:
				this.opcode_name = 'TXS';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.SP = this.X;
					opcode_done = true;
				}
				break;
			case 0xaa:
				this.opcode_name = 'TAX';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.X = this.A;
					opcode_done = true;
				}
				break;
			case 0xba:
				this.opcode_name = 'TSX';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.X = this.SP;
					opcode_done = true;
				}
				break;
			case 0xca:
				this.opcode_name = 'DEX';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 1) {
					this.X -= 1;
					this.set_nz(this.X);
					opcode_done = true;
				}
				break;
			case 0xea:
				this.opcode_name = 'NOP';
				this.addr_mode = 'implied';
				break;
				// Conditional branches & JSR/RTS
			case 0x10:
				this.opcode_name = 'BPL';
				this.addr_mode = 'relative';
				if (this.opcode_cycle === 1) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (this.S & 128) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
			case 0x20:
				this.opcode_name = 'JSR';
				this.addr_mode = 'absolute';
				this.operand = emulator.read_word(this.PC);
				if (this.opcode_cycle === 6) {
					this.push_word(this.PC + 2);
					this.PC = this.operand;
					console.log('Branching to ' + this.operand + '(' + this.operand.toString(16) + ')');
					opcode_done = true;
				}
				break;
			case 0x30:
				this.opcode_name = 'BMI';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (this.S & 128) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
			case 0x40:
				this.opcode_name = 'RTI';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 6) {
					this.S = this.pop_byte();
					this.PC = this.pop_word();
					opcode_done = true;
				}
				break;
			case 0x50:
				this.opcode_name = 'BVC'
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 3) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (this.S & 64) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
				break;
			case 0x60:
				this.opcode_name = 'RTS';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 6) {
					this.PC = this.pop_word();
					console.log('Returning to ' + this.PC + '(' + this.PC.toString(16) + ')');
					opcode_done = true;
				}
				break;
			case 0x70:
				this.opcode_name = 'BVS';
				this.addr_mode = 'implied';
				throw "Unimplemented opcode " + this.opcode_name;
				break;
			case 0x90:
				this.opcode_name = 'BCC';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (!(this.S & 1)) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
			case 0xb0:
				this.opcode_name = 'BCS';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (this.S & 1) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
			case 0xd0:
				this.opcode_name = 'BNE';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 2) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (this.S & 2) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
			case 0xf0:
				this.opcode_name = 'BEQ';
				this.addr_mode = 'implied';
				if (this.opcode_cycle === 1) {
					this.operand = emulator.read_byte(this.PC);
					this.PC += 1;
					if (this.S & 2) {
						this.calculate_branch(this.operand);
					}
					opcode_done = true;
				}
				break;
			default:
				switch (cc) {
					case 0b00: // cc = 00
						switch (bbb) {
							case 0:
								this.addr_mode = 'immediate';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 1:
								this.addr_mode = 'zeropage';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 3:
								this.addr_mode = 'absolute';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC);
									this.PC += 2;
								}
								break;
							case 5:
								this.addr_mode = 'zeropage,x';
								break;
							case 7:
								this.addr_mode = 'absolute,x';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC + this.X);
									this.PC += 2;
								}
								break;
							default:
								this.invalidOpcodeMessage(bbb)
						}
						switch (aaa) {
							case 0:
								throw new Error('Invalid opcode ' + aaa.toString(2) + ' at address ' + this.PC);
							case 1:
								this.opcode_name = 'BIT';
								switch (this.addr_mode) {
									case 'zeropage':
										if (this.opcode_cycle == 3) {
											this.do_bit(this.operand);
											opcode_done = true;
										}
										break;
									case 'absolute':
										if (this.opcode_cycle == 4) {
											this.do_bit(this.operand);
											opcode_done = true;
										}
										break;
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 2:
								this.opcode_name = 'JMP';
								break;
							case 3:
								this.opcode_name = 'JMP';
								break;
							case 4:
								this.opcode_name = 'STY';
								switch (this.addr_mode) {
									case 'absolute':
										if (this.opcode_cycle === 4) {
											emulator.write_byte(this.operand, this.Y);
											opcode_done = true;
										}
										break;
									case 'zeropage':
										if (this.opcode_cycle === 3) {
											emulator.write_byte(this.operand, this.Y)
											opcode_done = true
										}
										break;
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 5:
								this.opcode_name = 'LDY';
								switch (this.addr_mode) {
									case 'immediate':
										if (this.opcode_cycle === 1) {
											this.Y = this.operand;
											this.set_nz(this.Y);
											opcode_done = true;
										}
										break;
								}
								break;
							case 6:
								this.opcode_name = 'CPY'
								switch (this.addr_mode) {
									case 'zeropage':
										if (this.opcode_cycle === 3) {
											this.set_nz(this.Y - this.operand)
											this.setc(this.Y >= this.operand)
											opcode_done = true;
										}
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 7:
								this.opcode_name = 'CPX';
								this.invalidOpcodeMessage(bbb)
								break;
						}
						break;
					case 0b01: // cc = 01
						switch (bbb) {
							case 0:
								this.addr_mode = 'zeropage,x';
								throw new Error('Unimplemented addressing mode');
								break;
							case 1:
								this.addr_mode = 'zeropage';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 2:
								this.addr_mode = 'immediate';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 3:
								this.addr_mode = 'absolute';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC);
									this.PC += 2;
								}
								break;
							case 4:
								this.addr_mode = 'zeropage,y';
								throw new Error('Unimplemented addressing mode');
								break;
							case 5:
								this.addr_mode = 'zeropage,x';
								break;
							case 6:
								this.addr_mode = 'absolute,y';
								if (this.opcode_cycle === 1) {
									// operand implementation will add y
									this.operand = emulator.read_word(this.PC);
									this.PC += 2;
								}
								break;
							case 7:
								this.addr_mode = 'absolute,x';
								// operand implementation will add x
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_word(this.PC);
									this.PC += 2;
								}
								break;
							default:
								this.invalidOpcodeMessage(bbb)
						}
						switch (aaa) {
							case 0:
								this.opcode_name = 'ORA';
								break;
							case 1:
								this.opcode_name = 'AND';
								break;
							case 2:
								this.opcode_name = 'EOR'
								switch (this.addr_mode) {
									case 'immediate':
										if (this.opcode_cycle == 2) {
											this.A ^= this.operand
											this.set_nz(this.A)
											opcode_done = true
										}
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 3:
								this.opcode_name = 'ADC';
								switch (this.addr_mode) {
									case 'immediate':
										if (this.opcode_cycle === 2) {
											this.A += this.operand
											this.set_nz(this.A)
											this.setc(this.A)
											opcode_done = true
										}
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 4:
								this.opcode_name = 'STA';
								switch (this.addr_mode) {
									case 'absolute':
									case 'zeropage':
										if (this.opcode_cycle == 3) {
											emulator.write_byte(this.operand, this.A);
											opcode_done = true;
										}
										break;
									case 'absolute,y':
										if (this.opcode_cycle === 5) {
											emulator.write_byte(this.operand + this.Y, this.A);
											opcode_done = true;
										}
										break;
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 5:
								this.opcode_name = 'LDA';
								switch (this.addr_mode) {
									case 'immediate':
										if (this.opcode_cycle === 1) {
											this.A = this.operand;
											this.set_nz(this.A);
											opcode_done = true;
										}
										break;
									case 'absolute':
										if (this.opcode_cycle === 4) {
											this.A = emulator.read_byte(this.operand);
											this.set_nz(this.A);
											opcode_done = true;
										}
										break;
									case 'absolute,y':
										if (this.opcode_cycle === 4) {
											this.A = emulator.read_byte((this.operand + this.Y) & 0xffff);
											this.set_nz(this.A);
											opcode_done = true;
										}
										break;
									case 'zeropage,x':
										if(this.opcode_cycle === 4) {
											this.A = emulator.read_byte((this.operand + this.X) & 0x00ff)
											this.set_nz(this.A)
											opcode_done = true
										}
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 6:
								this.opcode_name = 'CMP';
								switch (this.addr_mode) {
									case 'immediate':
										if (this.opcode_cycle === 1) {
											this.set_nz(this.A - this.operand)
											this.setc(this.A >= this.operand)
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
					case 0b10: // cc = 10
						switch (bbb) {
							case 0:
								this.addr_mode = 'immediate';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 1:
								this.addr_mode = 'zeropage';
								if (this.opcode_cycle === 1) {
									this.operand = emulator.read_byte(this.PC);
									this.PC += 1;
								}
								break;
							case 2:
								this.addr_mode = 'accumulator';
								break;
							case 3:
								this.addr_mode = 'absolute';
								break;
							case 5:
								this.addr_mode = 'zeropage,x';
								break;
							case 7:
								this.addr_mode = 'absolute,x';
								break;
							default:
								this.invalidOpcodeMessage(bbb)
						}
						switch (aaa) {
							case 0:
								this.opcode_name = 'ASL';
								switch (this.addr_mode) {
									case 'accumulator':
										if (this.opcode_cycle === 2) {
											this.A = this.A << 1;
											opcode_done = true;
										}
										break;
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break;
							case 0b001:
								this.opcode_name = 'ROL'
								switch (this.addr_mode) {
									case 'zeropage':
										this.A = this.A << 1
										this.set_nz(this.A)
										this.setc(this.A)
										opcode_done = true
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break
							case 4:
								this.opcode_name = 'STX'
								switch (this.addr_mode) {
									case 'zeropage':
										if (this.opcode_cycle === 2) {
											emulator.write_byte(this.operand, this.X)
											opcode_done = true
										}
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break
							case 0b101:
								this.opcode_name = 'LDX'
								switch (this.addr_mode) {
									case 'immediate':
										if (this.opcode_cycle === 2) {
											this.X = this.operand
											this.set_nz(this.X)
											opcode_done = true
										}
										break
									default:
										this.invalidOpcodeMessage(bbb)
								}
								break
							default:
								throw new Error('Invalid opcode ' + this.opcode.toString(2) + ' at address ' + this.PC) + ' cc=10';
						}
						break;
					case 3: // cc = 11
						throw new Error('Invalid opcode ' + this.opcode.toString(2) + ' at address ' + this.PC + ' cc=11');
				}

		}

		if (1 === this.opcode_cycle) {
			var instruction_addr_symbol = emulator.symbol_table(this.instruction_addr);
			console.log(((undefined !== instruction_addr_symbol) ? instruction_addr_symbol : ('$' + this.instruction_addr.toString(16).toUpperCase())) + ' ' + this.opcode_name + ' ' + format_operand(this.operand, this.addr_mode) + '(' + this.opcode_cycle + ')');
		}

		if (opcode_done) {
			this.opcode_cycle = 0;
		} else {
			this.opcode_cycle += 1;
		}
	};

	this.status = function () {
		return 'A: ' + this.A.toString(16) + ' X: ' + this.X.toString(16) + ' Y: ' + this.Y.toString(16) + "\n" +
			'S: ' + this.S.toString(2) + "\n" +
			'PC: ' + this.PC.toString(16) + ' opcode: ' + this.opcode.toString(16) + ' ' + this.opcode_name + ' ' + this.addr_mode + "\n";
	};

	this.addressingModeName = (aaa, bbb, cc) => {
		if (cc === 0b01) {
			return ({
				0b000: '(zeropage,x)',
				0b001: 'zeropage',
				0b010: 'immediate',
				0b011: 'absolute',
				0b100: '(zeropage,y)',
				0b101: 'zeropage,x',
				0b110: 'absolute,y',
				0b111: 'absolute,x'
			})[bbb]
		} else if (cc === 0b10) {
			return ({
				0b000: 'immediate',
				0b001: 'zeropage',
				0b010: 'accumulator',
				0b011: 'absolute',
				0b101: 'zero page,y',
				0b111: 'absolute,y',
			})[bbb]
		} else if (cc === 0b00) {
			return ({
				0b000: 'immediate',
				0b001: 'zeropage',
				0b011: 'absolute',
				0b101: 'zeropage,x',
				0b111: 'absolute,x'
			})[bbb]
		} else if (cc === 0b11) {
			throw new Error('Invalid opcode ' + this.opcode.toString(2) + ' at address ' + this.PC + ' cc=11')
		}

	}

	this.invalidOpcodeMessage = function (bbb) {
		throw new Error('Invalid addressing mode ' + this.addr_mode + ' ' + bbb.toString(2) + ' for opcode ' + this.opcode_name + ' ' + this.opcode.toString(2) + ' at address ' + this.PC);
	}

}
