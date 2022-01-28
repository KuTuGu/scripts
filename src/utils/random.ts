// get random factor, default: [1, 2)
export const getRandomFactor = (expand = 1, offset = 1) => Math.random() * expand + offset

export const getRandomOne = <T>(arr: Array<T>): T => {
	return arr?.[
		Math.floor(
			Math.random() * arr?.length
		)
	]
}
