function PIA6821(emulator) {

	this.CRA = 0; this.PAI = 0; this.PAO = 0; this.DDRA = 0;
	this.CRB = 0; this.PBI = 0; this.PBO = 0; this.DDRB = 0;
	this.emulator = emulator;

	this.read = function(rs) {
		switch(rs) {
			case 0:
				this.CRA = this.CRA & 127;
				return (this.CRA & 3) ? (this.PAI & ~this.DDRA) : this.DDRA;
			case 1:
				return this.CRA;
			case 2:
				this.CRB = this.CRB & 127;
				return (this.CRB & 3) ? (this.PBI & ~this.DDRB) : this.DDRB;
			case 3:
				return this.CRB;
		}
	};

	this.write = function(rs, value) {
		switch(rs) {
			case 0:
				this.PAO = value;
				break;
			case 1:
				this.CRA = value & 63;
				break;
			case 2:
				this.PBO = value;
				break;
			case 3:
				this.CRB = value & 63;
				break;
		}
	};

	this.trigger_ca1 = function() {
		this.CRA = this.CRA | 128;
		if(this.CRA & 1) {
			this.emulator.cpu.irq();
		}
	};

	this.output_a = function() {
		return this.PAO & this.DDRA;
	};

	this.output_b = function() {
		return this.PBO & this.DDRB;
	};

	this.status = function() {
		return 'PAO: ' + this.PAO.toString(2) + ' ' + this.PAO.toString(16) + "\n" +
		       'CRA: ' + this.CRA.toString(2) + ' ' + this.CRA.toString(16) + "\n" +
		       'PB0: ' + this.PBO.toString(2) + ' ' + this.PBO.toString(16) + "\n" +
		       'CRB: ' + this.CRB.toString(2) + ' ' + this.CRB.toString(16) + "\n";
	};

}
