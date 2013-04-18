function PIA6821(emulator) {

	this.CRA = 0; this.PAI = 0; this.PAO = 0; this.DDRA = 0;
	this.CRB = 0; this.PBI = 0; this.PBO = 0; this.DDRB = 0;

	this.read = function(rs) {
		switch(rs) {
			case 0:
				return (this.CRA & 3) ? (this.PAI & ~this.DDRA) : this.DDRA;
			case 1:
				return this.CRA;
			case 2:
				return (this.CRB & 3) ? (this.PBI & ~this.DDRB) : this.DDRB;
			case 3:
				return this.CRB;
		}
	};

	this.write = function(rs, value) {
		switch(rs) {
			case 0:
			case 1:
				this.CRA = value & 63;
				break;
			case 2:
			case 3:
				this.CRB = value & 63;
				break;
		}
	};
}
