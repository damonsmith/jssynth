export class AmigaLowPassFilter {

	public static NZEROS = 2
	public static NPOLES = 2
	public static GAIN = 24.33619312

	private xv = [0, 0, 0]
	private yv = [0, 0, 0]

	public next(sample) {
		this.xv[0] = this.xv[1]
		this.xv[1] = this.xv[2]
		this.xv[2] = sample / AmigaLowPassFilter.GAIN
		this.yv[0] = this.yv[1]
		this.yv[1] = this.yv[2]
		this.yv[2] = (this.xv[0] + this.xv[2]) + 2 * this.xv[1]
			+ (-0.5147540757 * this.yv[0]) + (1.3503898310 * this.yv[1])
		return this.yv[2]
	}
}
